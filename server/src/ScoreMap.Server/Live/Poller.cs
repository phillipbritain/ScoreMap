using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.Options;
using ScoreMap.Server.Games;
using ScoreMap.Server.Hubs;

namespace ScoreMap.Server.Live;

/// <summary>
/// Keeps the game board current while at least one browser is connected, and pushes
/// the board's change events to every browser. Each league is fetched about every
/// <see cref="PollingOptions.LiveInterval"/> while it has Live games and every
/// <see cref="PollingOptions.QuietInterval"/> otherwise. With no browser connected nothing is fetched; the first browser to connect
/// again gets a snapshot fetched fresh for any league whose data has gone stale.
/// </summary>
public sealed class Poller(
    GameBoard board,
    BrowserConnections connections,
    IHubContext<GamesHub> hub,
    TimeProvider clock,
    IOptions<PollingOptions> polling,
    ILogger<Poller> logger) : BackgroundService
{
    private TimeSpan _liveInterval = polling.Value.LiveInterval;
    private TimeSpan _quietInterval = polling.Value.QuietInterval;

    // Serializes every use of the board, and keeps a snapshot and the change events
    // around it in order.
    private readonly SemaphoreSlim _lock = new(1, 1);
    private readonly Dictionary<string, DateTimeOffset> _nextFetch = new();

    // Completed to cut the wait for the next fetch short.
    private TaskCompletionSource _wake = new(TaskCreationOptions.RunContinuationsAsynchronously);

    /// <summary>
    /// Fetches every league straight away, and from then on at the given intervals: for when the
    /// game feed provider's source has changed (a scenario switch, ADR-0009).
    /// </summary>
    public async Task StartAfreshAsync(PollingOptions intervals, CancellationToken cancellationToken)
    {
        await _lock.WaitAsync(cancellationToken);
        try
        {
            _liveInterval = intervals.LiveInterval;
            _quietInterval = intervals.QuietInterval;
            _nextFetch.Clear();
            var wake = _wake;
            _wake = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
            wake.TrySetResult();
        }
        finally
        {
            _lock.Release();
        }
    }

    /// <summary>
    /// Brings stale leagues up to date, then hands the current games to <paramref name="send"/>.
    /// Changes found on the way go to every browser except <paramref name="connectionId"/>,
    /// which gets them in the snapshot.
    /// </summary>
    public async Task SendSnapshotAsync(string connectionId, Func<IReadOnlyList<Game>, Task> send, CancellationToken cancellationToken)
    {
        await _lock.WaitAsync(cancellationToken);
        try
        {
            await UpdateDueLeaguesAsync(hub.Clients.AllExcept(connectionId), cancellationToken);
            await send(board.Games);
        }
        finally
        {
            _lock.Release();
        }
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            await connections.WhenAnyConnectedAsync(stoppingToken);

            DateTimeOffset next;
            Task wake;
            await _lock.WaitAsync(stoppingToken);
            try
            {
                await UpdateDueLeaguesAsync(hub.Clients.All, stoppingToken);
                next = _nextFetch.Count == 0 ? clock.GetUtcNow() + _quietInterval : _nextFetch.Values.Min();
                wake = _wake.Task;
            }
            finally
            {
                _lock.Release();
            }

            await WaitUntilAsync(next, wake, stoppingToken);
        }
    }

    // How far the clock may move while a wait is being set up before it is set up again.
    private static readonly TimeSpan ClockSlack = TimeSpan.FromMilliseconds(1);

    /// <summary>
    /// Waits until <paramref name="due"/>, or until <paramref name="wake"/> completes. Waiting until a
    /// due time (not for a fixed delay) means a late start to the wait never pushes a fetch back.
    /// </summary>
    private async Task WaitUntilAsync(DateTimeOffset due, Task wake, CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            var now = clock.GetUtcNow();
            if (due <= now)
                return;
            using var waiting = CancellationTokenSource.CreateLinkedTokenSource(stoppingToken);
            var delay = Task.Delay(due - now, clock, waiting.Token);
            // The delay counts from when it was made, not from now: if the clock moved in between
            // (as a test's fake clock can), it would end late, so make it again.
            var moved = clock.GetUtcNow() - now > ClockSlack;
            if (!moved)
                await Task.WhenAny(delay, wake);
            await waiting.CancelAsync();
            if (!moved)
                return;
        }
    }

    private async Task UpdateDueLeaguesAsync(IClientProxy recipients, CancellationToken cancellationToken)
    {
        foreach (var league in board.Leagues)
        {
            var startedAt = clock.GetUtcNow();
            if (_nextFetch.TryGetValue(league.Key, out var due) && due > startedAt)
                continue;

            try
            {
                var changes = await board.UpdateLeagueAsync(league, cancellationToken);
                foreach (var change in changes)
                    await recipients.SendAsync(GamesHub.ChangeMessage, change, cancellationToken);
            }
            // Judged by the token, not the exception type: an HttpClient timeout is also an
            // OperationCanceledException, and must count as a failed update, not a cancellation.
            catch (Exception e) when (!cancellationToken.IsCancellationRequested)
            {
                logger.LogWarning(e, "Could not update {League}; keeping its games as they were", league.Name);
            }

            // Counted from when the fetch began, so time spent fetching (or the clock moving
            // meanwhile) never pushes the next fetch back.
            _nextFetch[league.Key] = startedAt + (board.HasLiveGames(league) ? _liveInterval : _quietInterval);
        }
    }
}
