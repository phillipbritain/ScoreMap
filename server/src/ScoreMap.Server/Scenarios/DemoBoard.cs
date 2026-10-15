using Microsoft.Extensions.Options;
using ScoreMap.Server.Games;
using ScoreMap.Server.Live;

namespace ScoreMap.Server.Scenarios;

/// <summary>
/// The demo board (ADR-0019): the worldwide scenario's games, beside the real game board, shared by
/// every browser that opens a demo, on the live site and on local runs alike. It plays at Normal on
/// its own scenario clock, apart from the pill's, and nothing can pause, speed up, reset or switch it.
/// It starts when the first demo viewer joins, and stops <see cref="StopsAfter"/> after the last
/// leaves, so the next one starts it afresh from the scenario's start (its seed and its clock).
/// </summary>
public sealed class DemoBoard(
    ScenarioLibrary library, IServiceProvider services, TimeProvider realTime, ILogger<DemoBoard> logger) : IAsyncDisposable
{
    /// <summary>The scenario a demo shows.</summary>
    public const string Scenario = "worldwide";

    /// <summary>How long the demo board keeps running after its last viewer leaves, for one who comes back.</summary>
    public static readonly TimeSpan StopsAfter = TimeSpan.FromMinutes(1);

    private readonly Lock _lock = new();
    // Every demo browser from when it joins, before its snapshot, which the running board's
    // connections count only from after it: so a browser still connecting keeps the board running.
    private readonly HashSet<string> _viewers = [];
    private Run? _running;
    // While nobody watches: when the running board stops, and the wait for then.
    private DateTimeOffset? _stopsAt;
    private CancellationTokenSource? _stopping;
    private int _runs;

    /// <summary>A demo board running: its games, the poller keeping them current, and its browsers.</summary>
    public sealed record Run(GameBoard Board, Poller Poller, BrowserConnections Connections);

    /// <summary>The demo board's games now, or none while it isn't running.</summary>
    public IReadOnlyList<Game> Games
    {
        get
        {
            lock (_lock)
                return _running?.Board.Games ?? [];
        }
    }

    /// <summary>
    /// Whether a browser is counted as watching the demo: from just after the hub sends its snapshot
    /// until it leaves.
    /// </summary>
    public bool IsWatching(string connectionId)
    {
        lock (_lock)
            return _running?.Connections.IsConnected(connectionId) == true;
    }

    /// <summary>
    /// Counts <paramref name="connectionId"/> as watching the demo, starting the demo board if it isn't
    /// running (or was due to stop), and returns it. Call <see cref="Leave"/> when the browser leaves,
    /// whether or not it got as far as its snapshot.
    /// </summary>
    public Run Join(string connectionId)
    {
        Run? stopped = null;
        try
        {
            lock (_lock)
            {
                if (_running is not null && _stopsAt <= realTime.GetUtcNow())
                    (stopped, _running) = (_running, null);
                CancelStop();
                _running ??= Start();
                _viewers.Add(connectionId);
                return _running;
            }
        }
        finally
        {
            // Even when starting afresh failed (say, a bad scenario file), so the old board's poller stops.
            if (stopped is not null)
                _ = StopAsync(stopped);
        }
    }

    /// <summary>
    /// Counts <paramref name="connectionId"/> as gone from the demo; after the last viewer leaves, the
    /// demo board stops <see cref="StopsAfter"/> later, unless another joins first.
    /// </summary>
    public void Leave(string connectionId)
    {
        lock (_lock)
        {
            if (!_viewers.Remove(connectionId))
                return;
            _running?.Connections.Disconnected(connectionId);
            if (_viewers.Count > 0 || _running is null)
                return;
            _stopsAt = realTime.GetUtcNow() + StopsAfter;
            _stopping = new CancellationTokenSource();
            _ = StopLaterAsync(_running, _stopping.Token);
        }
    }

    private Run Start()
    {
        var clock = new ScenarioClock(realTime, Speed.Normal);
        var feed = library.Start(library.Read(Scenario), clock);
        var board = ActivatorUtilities.CreateInstance<GameBoard>(services, feed, (TimeProvider)clock);
        // A group of its own each time, so nothing late from a board that has stopped reaches the next one's browsers.
        var connections = new BrowserConnections($"demo-{++_runs}");
        var poller = ActivatorUtilities.CreateInstance<Poller>(
            services, board, connections, Options.Create(ScenarioSwitcher.ScenarioPolling(Speed.Normal)));
        _ = poller.StartAsync(CancellationToken.None);
        logger.LogInformation("Started the demo board");
        return new Run(board, poller, connections);
    }

    private void CancelStop()
    {
        _stopping?.Cancel();
        _stopping?.Dispose();
        _stopping = null;
        _stopsAt = null;
    }

    private async Task StopLaterAsync(Run run, CancellationToken cancellationToken)
    {
        try
        {
            await Task.Delay(StopsAfter, realTime, cancellationToken);
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            return;
        }
        lock (_lock)
        {
            if (_running != run || cancellationToken.IsCancellationRequested)
                return;
            _running = null;
            CancelStop();
        }
        await StopAsync(run);
    }

    private async Task StopAsync(Run run)
    {
        await run.Poller.StopAsync(CancellationToken.None);
        run.Poller.Dispose();
        logger.LogInformation("Stopped the demo board, with nobody watching");
    }

    public async ValueTask DisposeAsync()
    {
        Run? running;
        lock (_lock)
        {
            (running, _running) = (_running, null);
            CancelStop();
        }
        if (running is not null)
            await StopAsync(running);
    }
}
