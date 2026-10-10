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
        server.Places.Add("GEHA Field at Arrowhead Stadium, Kansas City", new Coordinates(39.0489, -94.4839));
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
            Venue: new ProviderVenue("GEHA Field at Arrowhead Stadium", "Kansas City", "MO", "USA"),
            Broadcasters: [new ProviderBroadcaster("CBS", "USA")]));

        await using var client = await server.ConnectClientAsync();
        var snapshot = await client.NextSnapshotAsync();

        var game = Assert.Single(snapshot);
        Assert.Equal("401", game.Id);
        Assert.Equal("NFL", game.League);
        Assert.Equal("Football", game.Sport);
        Assert.Equal(kickoff, game.StartTime);
        Assert.Equal(new GameTeam("KC", "Kansas City Chiefs", "https://example.test/kc.png", 21), game.Home);
        Assert.Equal(new GameTeam("BUF", "Buffalo Bills", "https://example.test/buf.png", 17), game.Away);
        Assert.Equal("Q3 4:12", game.Clock);
        Assert.Equal(3, game.Period);
        Assert.Equal(new GameVenue("GEHA Field at Arrowhead Stadium", "Kansas City", "USA", 39.0489, -94.4839, "America/Chicago"), game.Venue);
        Assert.Equal([new GameBroadcaster("CBS", "USA", null)], game.Broadcasters);
    }

    [Fact]
    public async Task Each_venue_comes_with_its_local_time_zone()
    {
        await using var server = new ScoreMapServer();
        server.Places.Add("Tottenham Hotspur Stadium, London", new Coordinates(51.6043, -0.0664));
        server.Feed.SetScoreboard("football/nfl", ProviderGames.NflGame(server.Clock.GetUtcNow(), ProviderStatus.InProgress) with
        {
            Venue = new ProviderVenue("Tottenham Hotspur Stadium", "London", null, "England"),
        });

        await using var client = await server.ConnectClientAsync();
        var game = Assert.Single(await client.NextSnapshotAsync());

        Assert.Equal("Europe/London", game.Venue.TimeZone);
    }

    [Fact]
    public async Task A_venue_that_could_not_be_placed_has_no_time_zone()
    {
        await using var server = new ScoreMapServer();
        server.Feed.SetScoreboard("football/nfl", ProviderGames.NflGame(server.Clock.GetUtcNow(), ProviderStatus.InProgress) with
        {
            Venue = null,
        });

        await using var client = await server.ConnectClientAsync();
        var game = Assert.Single(await client.NextSnapshotAsync());

        Assert.Null(game.Venue.TimeZone);
    }

    [Fact]
    public async Task A_browser_that_leaves_before_its_snapshot_arrives_is_not_an_error()
    {
        await using var server = new ScoreMapServer();
        server.Feed.Hold(TestGames.Nfl);
        var client = await server.ConnectClientAsync();
        await server.Feed.WaitForFetchesAsync(TestGames.Nfl, 1);

        await client.DisposeAsync();
        await server.Feed.HeldFetchCancelledAsync();
        // The hub deals with the cancelled snapshot straight after; give an error the moment it would take to be logged.
        await Task.Delay(500);

        Assert.Empty(server.Logs.Errors);
    }
}
