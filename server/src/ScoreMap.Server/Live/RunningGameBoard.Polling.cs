using Microsoft.AspNetCore.SignalR;
using ScoreMap.Server.Games;
using ScoreMap.Server.Hubs;

namespace ScoreMap.Server.Live;

public sealed partial class RunningGameBoard
{
    private const int MaximumConcurrentFetches = 4;
    private static readonly TimeSpan SnapshotFreshnessBudget = TimeSpan.FromMilliseconds(250);

    private readonly SemaphoreSlim _lock = new(1, 1);
    private readonly SemaphoreSlim _fetchSlots = new(MaximumConcurrentFetches);
    private readonly CancellationTokenSource _lifetime = new();
    private FetchGeneration? _generation;
    private FetchGeneration Generation => _generation ??= new(_lifetime.Token);
    private sealed class FetchGeneration(CancellationToken lifetime)
    {
        public CancellationTokenSource Cancellation { get; } = CancellationTokenSource.CreateLinkedTokenSource(lifetime);
        public int Workers { get; set; }
        public bool Retired { get; set; }
    }
    // Leagues applied in this generation, excluding ones awaiting a replacement scoreboard.
    private readonly HashSet<string> _applied = [];
    private readonly Dictionary<string, DateTimeOffset> _nextFetch = new();
    private readonly HashSet<string> _fetching = [];
    private readonly HashSet<string> _enriching = [];
    private readonly HashSet<Task> _work = [];
    private TaskCompletionSource _wake = NewSignal();
    private int _joining;
    private const string TopEventsKey = "#top-events";

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var stopped = stoppingToken.Register(() => _lifetime.Cancel());
        try { await PollAsync(stoppingToken); }
        // Stopping is not a fault, even when the board is stopped before its host.
        catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { }
    }

    private async Task PollAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            await _connections.WhenAnyConnectedAsync(stoppingToken);
            DateTimeOffset next;
            Task wake;
            await _lock.WaitAsync(stoppingToken);
            try
            {
                if (_connections.HasAnyConnected)
                    ScheduleDue();
                next = _nextFetch.Where(p => !_fetching.Contains(p.Key)).Select(p => p.Value)
                    .DefaultIfEmpty(_clock.GetUtcNow() + _quietInterval).Min();
                wake = _wake.Task;
            }
            finally { _lock.Release(); }
            await WaitUntilAsync(next, wake, stoppingToken);
        }
    }

    // Called under the board gate. Workers yield before calling any outside dependency.
    private void ScheduleDue()
    {
        var now = _clock.GetUtcNow();
        Schedule(TopEventsKey, null);
        foreach (var league in _board.Leagues)
            Schedule(league.Key, league);

        void Schedule(string key, League? league)
        {
            if (_fetching.Contains(key) || (_nextFetch.TryGetValue(key, out var due) && due > now))
                return;
            _fetching.Add(key);
            // A top-events refresh must not update old games about to be replaced by this fetch.
            _applied.Remove(key);
            var startedAt = now;
            StartWork(async token =>
            {
                await _fetchSlots.WaitAsync(token);
                startedAt = _clock.GetUtcNow();
                try
                {
                    if (league is null)
                    {
                        var topEvents = await _board.FetchTopEventsAsync(token);
                        await ApplyAsync(() => _board.UpdateTopEvents(topEvents, _applied), token);
                    }
                    else
                    {
                        var scoreboard = await _board.FetchLeagueAsync(league, token);
                        await ApplyAsync(() =>
                        {
                            _applied.Add(key);
                            return _board.UpdateLeague(league, scoreboard, token);
                        }, token);
                    }
                }
                finally { _fetchSlots.Release(); }
            }, () =>
            {
                _fetching.Remove(key);
                _nextFetch[key] = startedAt + (league is not null && _board.HasLiveGames(league) ? _liveInterval : _quietInterval);
                if (league is not null && !_enriching.Contains(key))
                {
                    var games = _board.GamesToEnrich(league);
                    _enriching.Add(key);
                    StartWork(async enrichmentToken =>
                    {
                        foreach (var game in games)
                        {
                            var location = await _board.LocateVenueAsync(game, enrichmentToken);
                            await ApplyAsync(() => _board.UpdateVenue(league, game, location), enrichmentToken);
                        }
                    }, () => _enriching.Remove(key));
                }
            });
        }
    }

    private void StartWork(Func<CancellationToken, Task> action, Action finish)
    {
        var generation = Generation;
        generation.Workers++;
        Task? task = null;
        task = RunAsync();
        _work.Add(task);
        async Task RunAsync()
        {
            await Task.Yield();
            var token = generation.Cancellation.Token;
            try { await action(token); }
            catch (OperationCanceledException) when (token.IsCancellationRequested) { }
            catch (Exception e) when (!token.IsCancellationRequested)
            {
                _logger.LogWarning(e, "Could not refresh games; keeping the last available data");
            }
            finally
            {
                await _lock.WaitAsync(CancellationToken.None);
                try
                {
                    if (generation == _generation && !token.IsCancellationRequested)
                        finish();
                    _work.Remove(task!);
                    generation.Workers--;
                    if (generation.Retired && generation.Workers == 0)
                        generation.Cancellation.Dispose();
                    Wake();
                }
                finally { _lock.Release(); }
            }
        }
    }

    private async Task ApplyAsync(Func<IReadOnlyList<GameChange>> apply, CancellationToken cancellationToken)
    {
        await _lock.WaitAsync(cancellationToken);
        try
        {
            cancellationToken.ThrowIfCancellationRequested();
            foreach (var change in apply())
                await _hub.Clients.Group(_connections.Group).SendAsync(GamesHub.ChangeMessage, change, cancellationToken);
        }
        finally { _lock.Release(); }
    }

    private void RetireGeneration()
    {
        var generation = Generation;
        generation.Cancellation.Cancel();
        generation.Retired = true;
        if (generation.Workers == 0)
            generation.Cancellation.Dispose();
        _generation = new(_lifetime.Token);
        _fetching.Clear();
        _enriching.Clear();
        _nextFetch.Clear();
        _applied.Clear();
        Wake();
    }

    private void Wake()
    {
        var wake = _wake;
        _wake = NewSignal();
        wake.TrySetResult();
    }

    private static TaskCompletionSource NewSignal() => new(TaskCreationOptions.RunContinuationsAsynchronously);

    private async Task WaitUntilAsync(DateTimeOffset due, Task wake, CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            var now = _clock.GetUtcNow();
            if (due <= now)
                return;
            using var waiting = CancellationTokenSource.CreateLinkedTokenSource(stoppingToken);
            var delay = Task.Delay(due - now, _clock, waiting.Token);
            var moved = _clock.GetUtcNow() - now > TimeSpan.FromMilliseconds(1);
            if (!moved)
                await Task.WhenAny(delay, wake);
            await waiting.CancelAsync();
            if (!moved)
                return;
        }
    }

    public override async Task StopAsync(CancellationToken cancellationToken)
    {
        await _lifetime.CancelAsync();
        await base.StopAsync(cancellationToken);
        Task[] work;
        await _lock.WaitAsync(cancellationToken);
        try { work = _work.ToArray(); }
        finally { _lock.Release(); }
        await Task.WhenAll(work).WaitAsync(cancellationToken);
    }

    public override void Dispose()
    {
        _lifetime.Cancel();
        base.Dispose();
    }
}
