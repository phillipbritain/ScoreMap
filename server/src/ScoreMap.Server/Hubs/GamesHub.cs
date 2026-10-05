using Microsoft.AspNetCore.SignalR;
using ScoreMap.Server.Games;

namespace ScoreMap.Server.Hubs;

/// <summary>The SignalR hub browsers connect to. Sends a snapshot of current games on connect.</summary>
public sealed class GamesHub(GameBoard board) : Hub
{
    public const string Path = "/hubs/games";

    /// <summary>Client method that receives the full list of current games.</summary>
    public const string SnapshotMessage = "Snapshot";

    public override async Task OnConnectedAsync()
    {
        var games = await board.GetSnapshotAsync(Context.ConnectionAborted);
        await Clients.Caller.SendAsync(SnapshotMessage, games, Context.ConnectionAborted);
        await base.OnConnectedAsync();
    }
}
