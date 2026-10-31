using System.Text.Json;
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
            Contest: new ProviderSides(
                new ProviderTeam("KC", "Kansas City Chiefs", "https://example.test/kc.png", 21),
                new ProviderTeam("BUF", "Buffalo Bills", "https://example.test/buf.png", 17)),
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
        Assert.Equal(new GameTeam("KC", "Kansas City Chiefs", "https://example.test/kc.png", "21"), game.Sides().Home);
        Assert.Equal(new GameTeam("BUF", "Buffalo Bills", "https://example.test/buf.png", "17"), game.Sides().Away);
        Assert.Equal("Q3 4:12", game.Clock);
        Assert.Equal(3, game.Period);
        Assert.Equal(new GameVenue("GEHA Field at Arrowhead Stadium", "Kansas City", "Missouri", "USA", 39.0489, -94.4839, "America/Chicago"), game.Venue);
        Assert.Equal([new GameBroadcaster("CBS", "USA", null)], game.Broadcasters);
    }

    [Fact]
    public async Task A_game_between_two_sides_reaches_the_browser_as_a_contest_of_kind_sides()
    {
        await using var server = new ScoreMapServer();
        server.Feed.SetScoreboard("football/nfl", ProviderGames.NflGame(server.Clock.GetUtcNow(), ProviderStatus.InProgress));

        await using var client = await server.ConnectClientAsync();
        var game = Assert.Single(await client.NextSnapshotAsync());

        // As the hub writes it: camelCase, the shape told apart by its kind (web/src/games/game.ts).
        var contest = JsonSerializer.SerializeToElement(game, new JsonSerializerOptions(JsonSerializerDefaults.Web)).GetProperty("contest");
        Assert.Equal(("sides", "KC", "BUF"), (contest.GetProperty("kind").GetString(),
            contest.GetProperty("home").GetProperty("abbreviation").GetString(),
            contest.GetProperty("away").GetProperty("abbreviation").GetString()));
    }

    [Theory]
    [InlineData("186/6", "100/6 (13/20 ov, target 187)", "186/6", "100/6")]
    [InlineData("127", "128/2 (12.1/20 ov, target 128)", "127", "128/2")]
    [InlineData("54/1 (6.3/20 ov)", null, "54/1", null)]
    public async Task A_cricket_score_is_runs_and_wickets_or_runs_alone_when_all_out(
        string? away, string? home, string? awayScore, string? homeScore)
    {
        await using var server = new ScoreMapServer();
        server.Feed.SetScoreboard("cricket/8048", ClockLineTests.CricketGame(server, ProviderStatus.InProgress, 2, ProviderPeriodPhase.Playing, home, away));

        await using var client = await server.ConnectClientAsync();
        var game = Assert.Single(await client.NextSnapshotAsync());

        Assert.Equal(("Cricket", awayScore, homeScore), (game.Sport, game.Sides().Away.Score, game.Sides().Home.Score));
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
    public async Task A_venue_in_a_Canadian_province_names_the_province_in_full()
    {
        await using var server = new ScoreMapServer();
        server.Feed.SetScoreboard("football/nfl", ProviderGames.NflGame(server.Clock.GetUtcNow(), ProviderStatus.InProgress) with
        {
            Venue = new ProviderVenue("Scotiabank Arena", "Toronto", "ON", "Canada"),
        });

        await using var client = await server.ConnectClientAsync();
        var game = Assert.Single(await client.NextSnapshotAsync());

        Assert.Equal("Ontario", game.Venue.Region);
    }

    [Fact]
    public async Task A_venue_with_no_region_has_none()
    {
        await using var server = new ScoreMapServer();
        server.Feed.SetScoreboard("football/nfl", ProviderGames.NflGame(server.Clock.GetUtcNow(), ProviderStatus.InProgress) with
        {
            Venue = new ProviderVenue("Tottenham Hotspur Stadium", "London", null, "England"),
        });

        await using var client = await server.ConnectClientAsync();
        var game = Assert.Single(await client.NextSnapshotAsync());

        Assert.Null(game.Venue.Region);
        Assert.Equal("England", game.Venue.Country);
    }

    [Fact]
    public async Task A_region_that_is_not_a_US_state_or_Canadian_province_is_passed_on_as_given()
    {
        await using var server = new ScoreMapServer();
        server.Feed.SetScoreboard("football/nfl", ProviderGames.NflGame(server.Clock.GetUtcNow(), ProviderStatus.InProgress) with
        {
            Venue = new ProviderVenue("Estadio Azteca", "Mexico City", "CDMX", "Mexico"),
        });

        await using var client = await server.ConnectClientAsync();
        var game = Assert.Single(await client.NextSnapshotAsync());

        Assert.Equal("CDMX", game.Venue.Region);
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
