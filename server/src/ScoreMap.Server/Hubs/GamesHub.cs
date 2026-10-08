using Microsoft.AspNetCore.SignalR;
using ScoreMap.Server.Live;

namespace ScoreMap.Server.Hubs;

/// <summary>
/// The SignalR hub browsers connect to. Sends a snapshot of current games on connect
/// (including every automatic reconnect), and tells the poller who is connected.
/// Change events are pushed to it by the <see cref="Poller"/>.
/// </summary>
public sealed class GamesHub(Poller poller, BrowserConnections connections) : Hub
{
    public const string Path = "/hubs/games";

    /// <summary>Client method that receives the full list of current games.</summary>
    public const string SnapshotMessage = "Snapshot";

    /// <summary>Client method that receives one change event (a <see cref="Games.GameChange"/>).</summary>
    public const string ChangeMessage = "GameChanged";

    /// <summary>
    /// Client method that receives the name of the scenario now running (or "real") after a switch,
    /// so every browser's scenario pill follows (ADR-0009). Sent only when ScoreMap runs locally.
    /// </summary>
    public const string ScenarioSwitchedMessage = "ScenarioSwitched";

    public override async Task OnConnectedAsync()
    {
        try
        {
            await poller.SendSnapshotAsync(
                Context.ConnectionId,
                games => Clients.Caller.SendAsync(SnapshotMessage, games, Context.ConnectionAborted),
                Context.ConnectionAborted);
        }
        catch (OperationCanceledException) when (Context.ConnectionAborted.IsCancellationRequested)
        {
            // The browser left (closed or reloaded the page) before its snapshot was ready. Nothing
            // went wrong, so return quietly rather than let SignalR log it as an error.
            return;
        }
        connections.Connected(Context.ConnectionId);
        await base.OnConnectedAsync();
    }

    public override Task OnDisconnectedAsync(Exception? exception)
    {
        connections.Disconnected(Context.ConnectionId);
        return base.OnDisconnectedAsync(exception);
    }
}
