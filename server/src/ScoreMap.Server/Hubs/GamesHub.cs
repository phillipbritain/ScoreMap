using Microsoft.AspNetCore.SignalR;
using ScoreMap.Server.Live;
using ScoreMap.Server.Scenarios;

namespace ScoreMap.Server.Hubs;

/// <summary>
/// The SignalR hub browsers connect to. Sends a snapshot of current games on connect
/// (including every automatic reconnect), and tells the poller who is connected.
/// Change events are pushed to it by the <see cref="Poller"/>. Run locally on a scenario with a slow
/// start, it holds back the snapshot that long first, so the loading screen can be watched (ADR-0009).
/// A browser that connects with <see cref="DemoQuery"/> in the hub's address watches the
/// <see cref="DemoBoard"/> instead of the real game board (ADR-0019).
/// </summary>
public sealed class GamesHub(
    Poller poller, BrowserConnections connections, DemoBoard demo, IServiceProvider services, TimeProvider realTime) : Hub
{
    public const string Path = "/hubs/games";

    /// <summary>The query parameter (any value) a demo's browser adds to <see cref="Path"/>.</summary>
    public const string DemoQuery = "demo";

    /// <summary>The group of browsers watching the real game board (or, locally, the pill's scenario).</summary>
    public const string RealGamesGroup = "real-games";

    /// <summary>Client method that receives the full list of current games.</summary>
    public const string SnapshotMessage = "Snapshot";

    /// <summary>Client method that receives one change event (a <see cref="Games.GameChange"/>).</summary>
    public const string ChangeMessage = "GameChanged";

    /// <summary>
    /// Client method that receives the scenario listing (a <see cref="Scenarios.ScenarioEndpoints.ScenarioListing"/>)
    /// after a switch or a change of speed, so every browser's scenario pill, media keys and clock follow
    /// (ADR-0009). Sent only when ScoreMap runs locally.
    /// </summary>
    public const string ScenarioChangedMessage = "ScenarioChanged";

    public override async Task OnConnectedAsync()
    {
        if (Context.GetHttpContext()?.Request.Query.ContainsKey(DemoQuery) == true)
        {
            Context.Items[DemoQuery] = true;
            var run = demo.Join(Context.ConnectionId);
            try
            {
                await ConnectAsync(run.Poller, run.Connections, slowStart: TimeSpan.Zero);
            }
            catch
            {
                // SignalR doesn't call OnDisconnectedAsync when this throws.
                demo.Leave(Context.ConnectionId);
                throw;
            }
        }
        else
        {
            var slowStart = services.GetService<ScenarioSwitcher>()?.SlowStart ?? TimeSpan.Zero;
            await ConnectAsync(poller, connections, slowStart);
        }
        await base.OnConnectedAsync();
    }

    private async Task ConnectAsync(Poller poller, BrowserConnections connections, TimeSpan slowStart)
    {
        await Groups.AddToGroupAsync(Context.ConnectionId, connections.Group);
        try
        {
            if (slowStart > TimeSpan.Zero)
                await Task.Delay(slowStart, realTime, Context.ConnectionAborted);
            await poller.SendSnapshotAsync(
                Context.ConnectionId,
                games => Clients.Caller.SendAsync(SnapshotMessage, games, Context.ConnectionAborted),
                Context.ConnectionAborted);
        }
        catch (OperationCanceledException) when (Context.ConnectionAborted.IsCancellationRequested)
        {
            // The browser left (closed or reloaded the page) before its snapshot was ready or sent. Nothing
            // went wrong, so return quietly rather than let SignalR log it as an error.
            return;
        }
        connections.Connected(Context.ConnectionId);
    }

    public override Task OnDisconnectedAsync(Exception? exception)
    {
        if (Context.Items.ContainsKey(DemoQuery))
            demo.Leave(Context.ConnectionId);
        else
            connections.Disconnected(Context.ConnectionId);
        return base.OnDisconnectedAsync(exception);
    }
}
