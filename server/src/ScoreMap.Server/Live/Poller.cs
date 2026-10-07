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
    private readonly TimeSpan _liveInterval = polling.Value.LiveInterval;
    private readonly TimeSpan _quietInterval = polling.Value.QuietInterval;

    // Serializes every use of the board, and keeps a snapshot and the change events
    // around it in order.
    private readonly SemaphoreSlim _lock = new(1, 1);
    private readonly Dictionary<string, DateTimeOffset> _nextFetch = new();

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
            await _lock.WaitAsync(stoppingToken);
            try
            {
                await UpdateDueLeaguesAsync(hub.Clients.All, stoppingToken);
                next = _nextFetch.Count == 0 ? clock.GetUtcNow() + _quietInterval : _nextFetch.Values.Min();
            }
            finally
            {
                _lock.Release();
            }

            // Waiting until a due time (not for a fixed delay) means a late start to the
            // wait never pushes a fetch back.
            var wait = next - clock.GetUtcNow();
            if (wait > TimeSpan.Zero)
                await Task.Delay(wait, clock, stoppingToken);
        }
    }

    private async Task UpdateDueLeaguesAsync(IClientProxy recipients, CancellationToken cancellationToken)
    {
        foreach (var league in board.Leagues)
        {
            if (_nextFetch.TryGetValue(league.Key, out var due) && due > clock.GetUtcNow())
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

            _nextFetch[league.Key] = clock.GetUtcNow() + (board.HasLiveGames(league) ? _liveInterval : _quietInterval);
        }
    }
}
