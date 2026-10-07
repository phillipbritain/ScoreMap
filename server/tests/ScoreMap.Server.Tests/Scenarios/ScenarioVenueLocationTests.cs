using ScoreMap.Server.GameFeed;
using ScoreMap.Server.Scenarios;
using ScoreMap.Server.Tests.Support;

namespace ScoreMap.Server.Tests.Scenarios;

public class ScenarioVenueLocationTests : IDisposable
{
    private static readonly Coordinates Tottenham = new(51.6043, -0.0664);

    private readonly string _venueListPath = TempPath("scoremap-scenario-venues");

    private static string TempPath(string prefix) => Path.Combine(Path.GetTempPath(), $"{prefix}-{Guid.NewGuid():N}.json");

    public void Dispose() => File.Delete(_venueListPath);

    private void WriteVenueList(params (string Name, string City, string? Region, string Country)[] venues) =>
        File.WriteAllText(_venueListPath, System.Text.Json.JsonSerializer.Serialize(venues.Select(v => new
        {
            name = v.Name,
            city = v.City,
            region = v.Region,
            country = v.Country,
            homeTeam = new { name = "Home Team", abbreviation = "HOM", logoUrl = "https://a.espncdn.com/i/teamlogos/soccer/500/1.png" },
            groups = new[] { "worldwide" },
        })));

    private static ProviderGame GameAt(ProviderVenue venue) => new(
        Id: "401",
        LeagueKey: "soccer/eng.1",
        StartTime: new DateTimeOffset(2026, 10, 4, 17, 30, 0, TimeSpan.Zero),
        Home: new ProviderTeam("HOM", "Home Team", null, 1),
        Away: new ProviderTeam("AWY", "Away Team", null, 0),
        Status: ProviderStatus.InProgress,
        DisplayClock: "40'",
        Period: 1,
        Venue: venue,
        Broadcasters: []);

    [Fact]
    public async Task A_venue_in_the_checked_in_lookups_is_placed_without_a_place_search()
    {
        WriteVenueList(("Tottenham Hotspur Stadium", "London", null, "England"));
        var nominatim = new FakePlaceSearch();
        nominatim.Add("Tottenham Hotspur Stadium, London", Tottenham);
        await using var server = new ScoreMapServer();
        await ScenarioVenueLookup.UpdateAsync(_venueListPath, server.ScenarioVenueLocationsPath, nominatim, CancellationToken.None);

        server.Feed.SetScoreboard("soccer/eng.1", GameAt(new ProviderVenue("Tottenham Hotspur Stadium", "London", null, "England")));
        await using var client = await server.ConnectClientAsync();
        var game = Assert.Single(await client.NextSnapshotAsync());

        Assert.Equal((51.6043, -0.0664), (game.Venue.Latitude, game.Venue.Longitude));
        Assert.Empty(server.Places.Queries);
    }

    [Fact]
    public async Task Running_the_lookups_again_only_looks_up_venues_that_are_new()
    {
        var locationsPath = TempPath("scoremap-scenario-venue-locations");
        try
        {
            WriteVenueList(("Tottenham Hotspur Stadium", "London", null, "England"));
            var nominatim = new FakePlaceSearch();
            nominatim.Add("Tottenham Hotspur Stadium, London", Tottenham);
            nominatim.Add("Yankee Stadium, Bronx", new Coordinates(40.8296, -73.9262));
            await ScenarioVenueLookup.UpdateAsync(_venueListPath, locationsPath, nominatim, CancellationToken.None);

            WriteVenueList(("Tottenham Hotspur Stadium", "London", null, "England"), ("Yankee Stadium", "Bronx", "NY", "USA"));
            await ScenarioVenueLookup.UpdateAsync(_venueListPath, locationsPath, nominatim, CancellationToken.None);

            Assert.Equal(["Tottenham Hotspur Stadium, London", "Yankee Stadium, Bronx"], nominatim.Queries);
        }
        finally
        {
            File.Delete(locationsPath);
        }
    }

    [Fact]
    public async Task Venues_the_search_cannot_find_are_reported_and_left_out_of_the_lookups()
    {
        WriteVenueList(("Tottenham Hotspur Stadium", "London", null, "England"), ("Nowhere Arena", "Atlantis", null, "Atlantis"));
        var nominatim = new FakePlaceSearch();
        nominatim.Add("Tottenham Hotspur Stadium, London", Tottenham);
        await using var server = new ScoreMapServer();

        var notFound = await ScenarioVenueLookup.UpdateAsync(
            _venueListPath, server.ScenarioVenueLocationsPath, nominatim, CancellationToken.None);

        Assert.Equal(["Nowhere Arena"], notFound.Select(miss => miss.Venue.Name));
        server.Feed.SetScoreboard("soccer/eng.1", GameAt(new ProviderVenue("Nowhere Arena", "Atlantis", null, "Atlantis")));
        await using var client = await server.ConnectClientAsync();
        await client.NextSnapshotAsync();
        Assert.Contains("Nowhere Arena, Atlantis", server.Places.Queries);
    }

    public static TheoryData<Exception> SearchFailures => new()
    {
        new HttpRequestException("503 Service Unavailable"),
        new TaskCanceledException("timed out", new TimeoutException()),
    };

    [Theory]
    [MemberData(nameof(SearchFailures))]
    public async Task A_failed_search_is_reported_and_retried_on_the_next_run(Exception failure)
    {
        var locationsPath = TempPath("scoremap-scenario-venue-locations");
        try
        {
            WriteVenueList(("Yankee Stadium", "Bronx", "NY", "USA"), ("Tottenham Hotspur Stadium", "London", null, "England"));
            var nominatim = new FakePlaceSearch();
            nominatim.Add("Tottenham Hotspur Stadium, London", Tottenham);
            nominatim.Fail("Yankee Stadium, Bronx", failure);

            var notFound = await ScenarioVenueLookup.UpdateAsync(_venueListPath, locationsPath, nominatim, CancellationToken.None);
            Assert.Equal(["Yankee Stadium"], notFound.Select(miss => miss.Venue.Name));

            nominatim.Add("Yankee Stadium, Bronx", new Coordinates(40.8296, -73.9262));
            notFound = await ScenarioVenueLookup.UpdateAsync(_venueListPath, locationsPath, nominatim, CancellationToken.None);
            Assert.Empty(notFound);
            Assert.Equal(["Yankee Stadium, Bronx", "Tottenham Hotspur Stadium, London", "Yankee Stadium, Bronx"], nominatim.Queries);
        }
        finally
        {
            File.Delete(locationsPath);
        }
    }

    [Fact]
    public async Task A_cancelled_run_stops_and_keeps_the_venues_already_found()
    {
        var locationsPath = TempPath("scoremap-scenario-venue-locations");
        try
        {
            WriteVenueList(("Tottenham Hotspur Stadium", "London", null, "England"), ("Yankee Stadium", "Bronx", "NY", "USA"));
            using var cancel = new CancellationTokenSource();
            var nominatim = new FakePlaceSearch();
            nominatim.Add("Tottenham Hotspur Stadium, London", Tottenham);
            nominatim.OnSearch("Yankee Stadium, Bronx", cancel.Cancel);

            await Assert.ThrowsAnyAsync<OperationCanceledException>(() =>
                ScenarioVenueLookup.UpdateAsync(_venueListPath, locationsPath, nominatim, cancel.Token));

            var rerun = new FakePlaceSearch();
            rerun.Add("Yankee Stadium, Bronx", new Coordinates(40.8296, -73.9262));
            await ScenarioVenueLookup.UpdateAsync(_venueListPath, locationsPath, rerun, CancellationToken.None);
            Assert.Equal(["Yankee Stadium, Bronx"], rerun.Queries);
        }
        finally
        {
            File.Delete(locationsPath);
        }
    }
}
