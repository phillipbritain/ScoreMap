using ScoreMap.Server.GameFeed;
using ScoreMap.Server.Games;
using ScoreMap.Server.Hubs;
using ScoreMap.Server.Tests.Support;

namespace ScoreMap.Server.Tests;

public class SnapshotTests
{
    [Fact]
    public async Task Connecting_client_receives_a_snapshot_of_the_providers_games()
    {
        await using var server = new ScoreMapServer();
        var kickoff = server.Clock.GetUtcNow().AddHours(-1);
        server.Feed.SetScoreboard("football/nfl", new ProviderGame(
            Id: "401",
            LeagueKey: "football/nfl",
            StartTime: kickoff,
            Home: new ProviderTeam("KC", "Kansas City Chiefs", "https://example.test/kc.png", 21),
            Away: new ProviderTeam("BUF", "Buffalo Bills", "https://example.test/buf.png", 17),
            Status: ProviderStatus.InProgress,
            DisplayClock: "4:12",
            Period: 3,
            Venue: new ProviderVenue("GEHA Field at Arrowhead Stadium", "Kansas City", "MO", "USA",
                new Coordinates(39.0489, -94.4839)),
            Broadcasters: [new ProviderBroadcaster("CBS", "USA")]));

        await using var client = await server.ConnectClientAsync();
        var snapshot = await client.NextSnapshotAsync();

        var game = Assert.Single(snapshot);
        Assert.Equal("401", game.Id);
        Assert.Equal("NFL", game.League);
        Assert.Equal("American football", game.Sport);
        Assert.Equal(kickoff, game.StartTime);
        Assert.Equal(new GameTeam("KC", "Kansas City Chiefs", "https://example.test/kc.png", 21), game.Home);
        Assert.Equal(new GameTeam("BUF", "Buffalo Bills", "https://example.test/buf.png", 17), game.Away);
        Assert.Equal("Q3 4:12", game.Clock);
        Assert.Equal(3, game.Period);
        Assert.Equal(new GameVenue("GEHA Field at Arrowhead Stadium", "Kansas City", "USA", 39.0489, -94.4839), game.Venue);
    }
}
