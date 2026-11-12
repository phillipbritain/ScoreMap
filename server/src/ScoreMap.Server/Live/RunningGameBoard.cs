using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.Options;
using ScoreMap.Server.Games;
using ScoreMap.Server.Hubs;
using ScoreMap.Server.Scenarios;
using ScoreMap.Server.Venues;
using ScoreMap.Server.WatchLinks;
using ScenarioListing = ScoreMap.Server.Scenarios.ScenarioEndpoints.ScenarioListing;

namespace ScoreMap.Server.Live;

/// <summary>
/// One running game board: owns its games, viewers, fetch generations and ordered delivery.
/// Joining sends a snapshot before subscribing to changes; changing source retires old work before
/// publishing the new source and clock. External fetches and venue lookups never hold its gate.
/// </summary>
public sealed partial class RunningGameBoard : BackgroundService
{
    /// <summary>An Upcoming game gets its pin this long before its start (ADR-0021).</summary>
    public static readonly TimeSpan UpcomingWindow = TimeSpan.FromMinutes(30);

    /// <summary>A Final game keeps its pin this long after its end (ADR-0021).</summary>
    public static readonly TimeSpan FinalWindow = TimeSpan.FromMinutes(5);

    private readonly BoardState _board;
    private readonly BrowserConnections _connections;
    private readonly IHubContext<GamesHub> _hub;
    private readonly TimeProvider _clock;
    private readonly ILogger<RunningGameBoard> _logger;
    private readonly ScenarioSwitcher? _switcher;
    private TimeSpan _liveInterval;
    private TimeSpan _quietInterval;

    public RunningGameBoard(
        BoardSource source, VenueLocator venues, VenuePhotos photos,
        IStreamLinkSource streams, IOptions<List<League>> leagues, TimeProvider clock,
        IHubContext<GamesHub> hub, ILogger<RunningGameBoard> logger)
        : this(new BoardState(source.Feed, venues, photos, streams, leagues, source.GameClock),
            new BrowserConnections(GamesHub.RealGamesGroup), hub, clock,
            source.Polling, logger, source.Controls)
    { }

    private RunningGameBoard(
        BoardState board, BrowserConnections connections, IHubContext<GamesHub> hub, TimeProvider clock,
        PollingOptions polling, ILogger<RunningGameBoard> logger, ScenarioSwitcher? switcher = null)
    {
        _board = board;
        _connections = connections;
        _hub = hub;
        _clock = clock;
        _liveInterval = polling.LiveInterval;
        _quietInterval = polling.QuietInterval;
        _logger = logger;
        _switcher = switcher;
    }

    // Demo creation belongs here too: callers supply a source, never mutable board state or viewers.
    internal static RunningGameBoard CreateDemo(
        IServiceProvider services, BoardSource source, string group) =>
        new(ActivatorUtilities.CreateInstance<BoardState>(services, source.Feed, source.GameClock),
            new BrowserConnections(group), services.GetRequiredService<IHubContext<GamesHub>>(),
            services.GetRequiredService<TimeProvider>(), source.Polling,
            services.GetRequiredService<ILogger<RunningGameBoard>>(), source.Controls);

    /// <summary>A published immutable snapshot, safe to read while leagues update.</summary>
    public IReadOnlyList<Game> Games => _board.Games;
    public IReadOnlyList<League> Leagues => _board.Leagues;

    /// <summary>How long each viewer waits before joining, in real time.</summary>
    public TimeSpan SlowStart => _switcher?.SlowStart ?? TimeSpan.Zero;

    public bool IsWatching(string connectionId) => _connections.IsConnected(connectionId);
    public void Leave(string connectionId) => _connections.Disconnected(connectionId);

    /// <summary>Starts afresh, canceling the old generation first, then publishes and returns the scenario listing under the gate.</summary>
    public async Task<ScenarioListing> StartAfreshAsync(string name, Speed? speed, CancellationToken cancellationToken)
    {
        var switcher = _switcher ?? throw new InvalidOperationException("This board has no scenario controls");
        // Reading/validating a scenario file must not delay delivery or retire a working source on failure.
        var scenario = switcher.ReadScenario(name);
        await _lock.WaitAsync(cancellationToken);
        try
        {
            RetireGeneration();
            SetPolling(switcher.SwitchTo(name, scenario, speed));
            return await PublishScenarioAsync(cancellationToken);
        }
        finally { _lock.Release(); }
    }

    /// <summary>Continues at a new speed, retiring old-clock work first, then publishes and returns the scenario listing under the gate.</summary>
    public async Task<ScenarioListing> ChangeSpeedAsync(Speed speed, CancellationToken cancellationToken)
    {
        var switcher = _switcher ?? throw new InvalidOperationException("This board has no scenario controls");
        await _lock.WaitAsync(cancellationToken);
        try
        {
            RetireGeneration();
            SetPolling(switcher.ChangeSpeed(speed));
            return await PublishScenarioAsync(cancellationToken);
        }
        finally { _lock.Release(); }
    }

    /// <summary>A coherent listing of the scenario controls, serialized with changes to them.</summary>
    public async Task<ScenarioListing> ScenarioListingAsync(CancellationToken cancellationToken)
    {
        await _lock.WaitAsync(cancellationToken);
        try { return ListScenario(); }
        finally { _lock.Release(); }
    }

    private ScenarioListing ListScenario() => _switcher is { } switcher
        ? new(switcher.Running, switcher.Scenarios, switcher.Speed.Name, Speed.All, switcher.CanControlPlay,
            switcher.Clock, StartsSlowly: switcher.SlowStart > TimeSpan.Zero)
        : new(ScenarioSwitcher.RealGames, [], Speed.Normal.Name, [], CanControlPlay: false, ClockAnchor.RealTime(_clock));

    // Called under the board's gate: publication completes before the next control change takes effect,
    // just as snapshots and game changes are ordered. No external fetch is awaited here.
    private async Task<ScenarioListing> PublishScenarioAsync(CancellationToken cancellationToken)
    {
        var listing = ListScenario();
        await _hub.Clients.Group(_connections.Group).SendAsync(GamesHub.ScenarioChangedMessage, listing, cancellationToken);
        return listing;
    }

    private void SetPolling(PollingOptions polling) =>
        (_liveInterval, _quietInterval) = (polling.LiveInterval, polling.QuietInterval);

    /// <summary>
    /// Sends a snapshot, subscribes to ordered changes and counts the viewer, as one hand-off.
    /// Waits at most 250 ms for fresh dependency results before sending the current games.
    /// </summary>
    public async Task JoinAsync(string connectionId, CancellationToken cancellationToken)
    {
        await _lock.WaitAsync(cancellationToken);
        _joining++;
        var joined = false;
        try
        {
            try { ScheduleDue(); }
            finally { _lock.Release(); }
            using var budget = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
            // Real time: a scenario clock or fake scheduling clock must not lengthen this bound.
            budget.CancelAfter(SnapshotFreshnessBudget);
            try
            {
                while (true)
                {
                    Task[] work;
                    await _lock.WaitAsync(budget.Token);
                    try { work = _work.ToArray(); }
                    finally { _lock.Release(); }
                    if (work.Length == 0)
                        break;
                    await Task.WhenAll(work).WaitAsync(budget.Token);
                }
            }
            catch (OperationCanceledException) when (budget.IsCancellationRequested && !cancellationToken.IsCancellationRequested) { }

            await _lock.WaitAsync(cancellationToken);
            try
            {
                await _hub.Clients.Client(connectionId).SendAsync(GamesHub.SnapshotMessage, Games, cancellationToken);
                await _hub.Groups.AddToGroupAsync(connectionId, _connections.Group, cancellationToken);
                cancellationToken.ThrowIfCancellationRequested();
                _connections.Connected(connectionId);
                joined = true;
            }
            finally { _lock.Release(); }
        }
        finally
        {
            if (!joined)
            {
                // A failed group add may have taken effect before throwing or observing cancellation.
                try { await _hub.Groups.RemoveFromGroupAsync(connectionId, _connections.Group, CancellationToken.None); }
                catch (Exception e) { _logger.LogWarning(e, "Could not remove a failed viewer from the delivery group"); }
                _connections.Disconnected(connectionId);
            }
            await _lock.WaitAsync(CancellationToken.None);
            try
            {
                _joining--;
                if (!joined && _joining == 0 && !_connections.HasAnyConnected)
                    RetireGeneration();
            }
            finally { _lock.Release(); }
        }
    }

    private sealed class BrowserConnections(string group)
    {
        /// <summary>The delivery group for this board's viewers.</summary>
        public string Group { get; } = group;

        private readonly HashSet<string> _ids = [];
        private TaskCompletionSource _anyConnected = NewSignal();

        public void Connected(string connectionId)
        {
            lock (_ids)
            {
                if (_ids.Add(connectionId) && _ids.Count == 1)
                    _anyConnected.TrySetResult();
            }
        }

        public void Disconnected(string connectionId)
        {
            lock (_ids)
            {
                if (_ids.Remove(connectionId) && _ids.Count == 0)
                    _anyConnected = NewSignal();
            }
        }

        /// <summary>
        /// Whether a browser is counted as connected: from after its snapshot and group membership
        /// until it leaves.
        /// </summary>
        public bool IsConnected(string connectionId)
        {
            lock (_ids)
                return _ids.Contains(connectionId);
        }

        public bool HasAnyConnected
        {
            get { lock (_ids) return _ids.Count > 0; }
        }

        /// <summary>Completes as soon as at least one browser is connected.</summary>
        public Task WhenAnyConnectedAsync(CancellationToken cancellationToken)
        {
            lock (_ids)
                return _anyConnected.Task.WaitAsync(cancellationToken);
        }

        private static TaskCompletionSource NewSignal() => new(TaskCreationOptions.RunContinuationsAsynchronously);
    }
}
