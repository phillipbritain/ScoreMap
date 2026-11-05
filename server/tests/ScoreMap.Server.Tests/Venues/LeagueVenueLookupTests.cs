using ScoreMap.Server.GameFeed;
using ScoreMap.Server.Tests.Support;
using ScoreMap.Server.Venues;
using static ScoreMap.Server.Tests.Support.TestGames;

namespace ScoreMap.Server.Tests.Venues;

/// <summary>The checked-in live league venue lookups, made by scripts/lookup-league-venues.cs.</summary>
public class LeagueVenueLookupTests
{
    private const string Arrowhead = "GEHA Field at Arrowhead Stadium, Kansas City";
    private static readonly Coordinates ArrowheadPosition = new(39.0489, -94.4839);
    private static readonly Coordinates KansasCity = new(39.0997, -94.5786);

    private static ProviderGame GameAt(ProviderVenue? venue, string id = "401") =>
        LiveGame(TimeProvider.System, id) with { Venue = venue };

    [Fact]
    public async Task A_venue_in_the_league_lookups_is_placed_in_the_join_snapshot_while_the_place_search_is_held()
    {
        await using var server = new ScoreMapServer();
        var nominatim = new FakePlaceSearch();
        nominatim.Add(Arrowhead, ArrowheadPosition);
        var game = LiveGame(server.Clock, "401");
        await LeagueVenueLookup.UpdateAsync([game], server.LeagueVenueLocationsPath, nominatim, CancellationToken.None);

        server.Places.Hold(Arrowhead);
        server.Feed.SetScoreboard(Nfl, game);
        await using var client = await server.ConnectClientAsync();
        var placed = Assert.Single(await client.NextSnapshotAsync());

        Assert.Equal((ArrowheadPosition.Latitude, ArrowheadPosition.Longitude), (placed.Venue.Latitude, placed.Venue.Longitude));
        Assert.Empty(server.Places.Queries);
    }

    [Fact]
    public async Task A_venue_the_search_cannot_find_is_kept_as_a_miss_and_placed_at_its_city_without_a_search()
    {
        await using var server = new ScoreMapServer();
        var nominatim = new FakePlaceSearch();
        nominatim.Add("Kansas City, MO, USA", KansasCity);
        var game = LiveGame(server.Clock, "401");
        await LeagueVenueLookup.UpdateAsync([game], server.LeagueVenueLocationsPath, nominatim, CancellationToken.None);
        Assert.Equal([Arrowhead, "Kansas City, MO, USA"], nominatim.Queries);

        server.Feed.SetScoreboard(Nfl, game);
        await using var client = await server.ConnectClientAsync();
        var placed = Assert.Single(await client.NextSnapshotAsync());

        Assert.Equal((KansasCity.Latitude, KansasCity.Longitude), (placed.Venue.Latitude, placed.Venue.Longitude));
        Assert.Empty(server.Places.Queries);
    }

    [Fact]
    public async Task A_correction_still_comes_before_the_league_lookups()
    {
        await using var server = new ScoreMapServer();
        var nominatim = new FakePlaceSearch();
        nominatim.Add(Arrowhead, ArrowheadPosition);
        var game = LiveGame(server.Clock, "401");
        await LeagueVenueLookup.UpdateAsync([game], server.LeagueVenueLocationsPath, nominatim, CancellationToken.None);
        server.CorrectVenue("GEHA Field at Arrowhead Stadium", new Coordinates(39.05, -94.48));

        server.Feed.SetScoreboard(Nfl, game);
        await using var client = await server.ConnectClientAsync();
        var placed = Assert.Single(await client.NextSnapshotAsync());

        Assert.Equal((39.05, -94.48), (placed.Venue.Latitude, placed.Venue.Longitude));
    }

    [Fact]
    public async Task Running_again_keeps_every_lookup_and_only_asks_new_queries()
    {
        var path = TempPath();
        try
        {
            var nominatim = new FakePlaceSearch();
            nominatim.Add(Arrowhead, ArrowheadPosition);
            nominatim.Add("Yankee Stadium, Bronx", new Coordinates(40.8296, -73.9262));
            await LeagueVenueLookup.UpdateAsync([GameAt(new("GEHA Field at Arrowhead Stadium", "Kansas City", "MO", "USA"))],
                path, nominatim, CancellationToken.None);

            await LeagueVenueLookup.UpdateAsync([
                GameAt(new("Yankee Stadium", "Bronx", "NY", "USA"), "402"),
                GameAt(new("GEHA Field at Arrowhead Stadium", "Kansas City", "MO", "USA"), "403"),
            ], path, nominatim, CancellationToken.None);

            Assert.Equal([Arrowhead, "Yankee Stadium, Bronx"], nominatim.Queries);
            Assert.Contains(Arrowhead, File.ReadAllText(path));
        }
        finally
        {
            File.Delete(path);
        }
    }

    [Fact]
    public async Task A_failed_search_is_reported_left_out_and_asked_again_on_the_next_run()
    {
        var path = TempPath();
        try
        {
            var nominatim = new FakePlaceSearch();
            nominatim.Fail(Arrowhead, new HttpRequestException("503 Service Unavailable"));
            var game = GameAt(new("GEHA Field at Arrowhead Stadium", "Kansas City", "MO", "USA"));

            Assert.Equal([Arrowhead], await LeagueVenueLookup.UpdateAsync([game], path, nominatim, CancellationToken.None));
            nominatim.Add(Arrowhead, ArrowheadPosition);
            Assert.Empty(await LeagueVenueLookup.UpdateAsync([game], path, nominatim, CancellationToken.None));

            Assert.Equal([Arrowhead, Arrowhead], nominatim.Queries);
        }
        finally
        {
            File.Delete(path);
        }
    }

    [Fact]
    public async Task A_game_whose_venue_comes_with_its_position_needs_no_lookup()
    {
        var path = TempPath();
        try
        {
            var nominatim = new FakePlaceSearch();
            await LeagueVenueLookup.UpdateAsync(
                [GameAt(new("Indianapolis Motor Speedway", "Speedway", "IN", "USA", Location: new(39.795, -86.235)))],
                path, nominatim, CancellationToken.None);

            Assert.Empty(nominatim.Queries);
        }
        finally
        {
            File.Delete(path);
        }
    }

    [Fact]
    public void The_checked_in_league_lookups_read_as_queries_mapped_to_positions_or_misses()
    {
        var lookups = System.Text.Json.JsonSerializer.Deserialize<Dictionary<string, Coordinates?>>(
            File.ReadAllText(Path.Combine(Scenarios.ScenarioVenueListTests.ServerProjectFolder, "league-venue-locations.json")),
            new System.Text.Json.JsonSerializerOptions(System.Text.Json.JsonSerializerDefaults.Web))!;

        Assert.NotEmpty(lookups); // run scripts/lookup-league-venues.cs to make it
    }

    private static string TempPath() => Path.Combine(Path.GetTempPath(), $"scoremap-league-venue-locations-{Guid.NewGuid():N}.json");
}
