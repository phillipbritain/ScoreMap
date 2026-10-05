using ScoreMap.Server.GameFeed;
using ScoreMap.Server.Live;
using ScoreMap.Server.Tests.Support;

namespace ScoreMap.Server.Tests;

public class VenuePlacementTests
{
    private static readonly Coordinates Tottenham = new(51.6043, -0.0664);

    private static ProviderGame LondonGame(string id = "401872965") => new(
        Id: id,
        LeagueKey: "football/nfl",
        StartTime: new DateTimeOffset(2026, 10, 4, 13, 30, 0, TimeSpan.Zero),
        Home: new ProviderTeam("WSH", "Washington Commanders", null, 13),
        Away: new ProviderTeam("IND", "Indianapolis Colts", null, 30),
        Status: ProviderStatus.Final,
        DisplayClock: "0:00",
        Period: 4,
        Venue: new ProviderVenue("Tottenham Hotspur Stadium", "London", null, "England"),
        Broadcasters: []);

    [Fact]
    public async Task Pin_is_placed_at_the_looked_up_venue_not_the_home_teams_city()
    {
        await using var server = new ScoreMapServer();
        server.Places.Add("Tottenham Hotspur Stadium, London", Tottenham);
        server.Feed.SetScoreboard("football/nfl", LondonGame());

        await using var client = await server.ConnectClientAsync();
        var game = Assert.Single(await client.NextSnapshotAsync());

        Assert.Equal((51.6043, -0.0664), (game.Venue.Latitude, game.Venue.Longitude));
        Assert.Equal("Tottenham Hotspur Stadium", game.Venue.Name);
        Assert.Equal("London", game.Venue.City);
        Assert.Equal("England", game.Venue.Country);
    }

    [Fact]
    public async Task Each_venue_is_looked_up_only_once()
    {
        await using var server = new ScoreMapServer();
        server.Places.Add("Tottenham Hotspur Stadium, London", Tottenham);
        server.Feed.SetScoreboard("football/nfl", LondonGame("a"), LondonGame("b"));

        await using (var first = await server.ConnectClientAsync())
            await first.NextSnapshotAsync();
        await using var second = await server.ConnectClientAsync();
        var games = await second.NextSnapshotAsync();

        Assert.All(games, g => Assert.Equal((51.6043, -0.0664), (g.Venue.Latitude, g.Venue.Longitude)));
        Assert.Equal(["Tottenham Hotspur Stadium, London"], server.Places.Queries);
    }

    [Fact]
    public async Task A_restarted_server_uses_the_saved_location_without_looking_it_up_again()
    {
        string savedLocations;
        await using (var firstRun = new ScoreMapServer())
        {
            firstRun.Places.Add("Tottenham Hotspur Stadium, London", Tottenham);
            firstRun.Feed.SetScoreboard("football/nfl", LondonGame());
            await using var client = await firstRun.ConnectClientAsync();
            await client.NextSnapshotAsync();
            savedLocations = File.ReadAllText(firstRun.SavedVenueLocationsPath);
        }

        var path = Path.Combine(Path.GetTempPath(), $"scoremap-venues-{Guid.NewGuid():N}.json");
        File.WriteAllText(path, savedLocations);
        try
        {
            await using var laterRun = new ScoreMapServer(path);
            laterRun.Feed.SetScoreboard("football/nfl", LondonGame());
            await using var client = await laterRun.ConnectClientAsync();
            var game = Assert.Single(await client.NextSnapshotAsync());

            Assert.Equal((51.6043, -0.0664), (game.Venue.Latitude, game.Venue.Longitude));
            Assert.Empty(laterRun.Places.Queries);
        }
        finally
        {
            File.Delete(path);
        }
    }

    [Fact]
    public async Task A_venue_the_search_cannot_find_is_not_searched_for_again()
    {
        await using var server = new ScoreMapServer();
        server.Feed.SetScoreboard("football/nfl", LondonGame());

        await using (var first = await server.ConnectClientAsync())
            await first.NextSnapshotAsync();
        await using var second = await server.ConnectClientAsync();
        await second.NextSnapshotAsync();

        Assert.Equal(["Tottenham Hotspur Stadium, London", "London, England"], server.Places.Queries);
    }

    [Fact]
    public async Task A_correction_overrides_the_looked_up_location()
    {
        await using var server = new ScoreMapServer();
        server.Places.Add("Lincoln Financial Field, Philadelphia", new Coordinates(40.8136, -96.7026)); // Lincoln, Nebraska
        server.CorrectVenue("Lincoln Financial Field", new Coordinates(39.9008, -75.1675));
        server.Feed.SetScoreboard("football/nfl", LondonGame() with
        {
            Venue = new ProviderVenue("Lincoln Financial Field", "Philadelphia", "PA", "USA"),
        });

        await using var client = await server.ConnectClientAsync();
        var game = Assert.Single(await client.NextSnapshotAsync());

        Assert.Equal((39.9008, -75.1675), (game.Venue.Latitude, game.Venue.Longitude));
        Assert.Empty(server.Places.Queries);
    }

    [Fact]
    public async Task A_correction_made_while_the_server_runs_moves_the_pin()
    {
        await using var server = new ScoreMapServer();
        server.Places.Add("Tottenham Hotspur Stadium, London", new Coordinates(1, 1));
        server.Feed.SetScoreboard("football/nfl", LondonGame());
        await using (var first = await server.ConnectClientAsync())
            await first.NextSnapshotAsync();

        server.CorrectVenue("Tottenham Hotspur Stadium", Tottenham);
        server.Clock.Advance(Poller.QuietInterval); // the correction applies from the next poll
        await using var second = await server.ConnectClientAsync();
        var game = Assert.Single(await second.NextSnapshotAsync());

        Assert.Equal((51.6043, -0.0664), (game.Venue.Latitude, game.Venue.Longitude));
    }

    [Fact]
    public async Task A_venue_the_search_cannot_find_falls_back_to_its_city_centre()
    {
        await using var server = new ScoreMapServer();
        server.Places.Add("London, England", new Coordinates(51.5074, -0.1278));
        server.Feed.SetScoreboard("football/nfl", LondonGame());

        await using var client = await server.ConnectClientAsync();
        var game = Assert.Single(await client.NextSnapshotAsync());

        Assert.Equal((51.5074, -0.1278), (game.Venue.Latitude, game.Venue.Longitude));
        Assert.Equal("Tottenham Hotspur Stadium", game.Venue.Name);
    }

    [Fact]
    public async Task A_game_with_no_venue_falls_back_to_the_home_teams_city()
    {
        await using var server = new ScoreMapServer();
        server.Places.Add("Charlotte, NC, USA", new Coordinates(35.2272, -80.8431));
        server.Feed.SetScoreboard("football/nfl", LondonGame() with
        {
            Home = new ProviderTeam("CAR", "Carolina Panthers", null, 7, new ProviderCity("Charlotte", "NC", "USA")),
            Venue = null,
        });

        await using var client = await server.ConnectClientAsync();
        var game = Assert.Single(await client.NextSnapshotAsync());

        Assert.Equal((35.2272, -80.8431), (game.Venue.Latitude, game.Venue.Longitude));
    }

    [Fact]
    public async Task Every_game_gets_a_pin_even_when_nothing_can_be_found()
    {
        await using var server = new ScoreMapServer();
        server.Places.Add("Charlotte, NC, USA", new Coordinates(35.2272, -80.8431));
        server.Feed.SetScoreboard("football/nfl",
            LondonGame("unfindable venue"),
            LondonGame("no venue, home city known") with
            {
                Home = new ProviderTeam("CAR", "Carolina Panthers", null, 7, new ProviderCity("Charlotte", "NC", "USA")),
                Venue = null,
            },
            LondonGame("nothing known") with { Venue = null });

        await using var client = await server.ConnectClientAsync();
        var games = await client.NextSnapshotAsync();

        Assert.Equal(["unfindable venue", "no venue, home city known", "nothing known"], games.Select(g => g.Id));
    }
}
