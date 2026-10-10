using System.Net.Http.Json;
using ScoreMap.Server.GameFeed;
using ScoreMap.Server.Games;
using ScoreMap.Server.Tests.Support;

namespace ScoreMap.Server.Tests.Scenarios;

/// <summary>
/// The scenario files that ship in the repo, run as the owner runs them locally: each shows what
/// its description in the run-scoremap skill says.
/// </summary>
public class ShippedScenarioTests
{
    private static readonly string ShippedFolder = Path.Combine(ScenarioVenueListTests.ServerProjectFolder, "Scenarios", "Files");

    private sealed record ScenarioListing(string Running, string[] Scenarios, bool CanControlPlay);

    [Fact]
    public async Task Every_scenario_file_in_the_repo_loads_and_worldwide_is_the_default()
    {
        await using var server = new ScoreMapServer { UseShippedScenarios = true };
        using var http = server.CreateClient();

        var listing = await http.GetFromJsonAsync<ScenarioListing>("/api/scenarios");

        Assert.NotNull(listing);
        Assert.Equal("worldwide", listing.Running);
        Assert.Equal(["crowded", "edge-cases", "empty", "worldwide"], listing.Scenarios);
        foreach (var name in listing.Scenarios)
        {
            var response = await http.PutAsJsonAsync("/api/scenarios/running", new { name });
            Assert.True(response.IsSuccessStatusCode, $"{name}: {await response.Content.ReadAsStringAsync()}");
        }
    }

    [Theory]
    [InlineData("crowded", true)]
    [InlineData("worldwide", true)]
    [InlineData("edge-cases", false)]
    [InlineData("empty", false)]
    public async Task Play_can_be_controlled_only_in_the_scenarios_that_play(string name, bool canControlPlay)
    {
        await using var server = new ScoreMapServer { UseShippedScenarios = true };
        using var http = server.CreateClient();

        var response = await http.PutAsJsonAsync("/api/scenarios/running", new { name });

        Assert.Equal(canControlPlay, (await response.Content.ReadFromJsonAsync<ScenarioListing>())?.CanControlPlay);
    }

    public static TheoryData<string> ScenariosAtListedVenues => new(
        Directory.GetFiles(ShippedFolder, "*.json").Select(Path.GetFileNameWithoutExtension).OfType<string>()
            .Where(name => name != "edge-cases"));

    [Theory]
    [MemberData(nameof(ScenariosAtListedVenues))]
    public async Task Every_scenario_but_edge_cases_places_its_games_from_the_checked_in_lookups(string name)
    {
        await using var server = new ScoreMapServer { UseShippedScenarios = true };

        await using var client = await StartAsync(server, name);
        await client.NextSnapshotAsync();

        Assert.Empty(server.Places.Queries); // add the venue to scenario-venues.json and run scripts/lookup-scenario-venues.cs
    }

    [Fact]
    public async Task Worldwide_shows_about_150_games_in_every_status()
    {
        await using var server = new ScoreMapServer { UseShippedScenarios = true };

        await using var client = await server.ConnectClientAsync();
        var snapshot = await client.NextSnapshotAsync();

        Assert.InRange(snapshot.Count, 140, 160);
        Assert.Equal(Enum.GetValues<GameStatus>().ToHashSet(), snapshot.Select(g => g.Status).ToHashSet());
        Assert.True(snapshot.Select(g => g.Venue.Country).Distinct().Count() >= 20, "games in at least 20 countries");
    }

    [Fact]
    public async Task Worldwide_starts_about_5_percent_of_its_games_disrupted_in_every_way()
    {
        await using var server = new ScoreMapServer { UseShippedScenarios = true };

        await using var client = await server.ConnectClientAsync();
        var snapshot = await client.NextSnapshotAsync();

        Assert.InRange(snapshot.Count(g => g.Status == GameStatus.Disrupted), 6, 10);
        Assert.Equal(Enum.GetValues<Disruption>().ToHashSet(), snapshot.Select(g => g.Disruption).OfType<Disruption>().ToHashSet());
    }

    [Fact]
    public async Task Worldwide_scores_by_itself()
    {
        await using var server = new ScoreMapServer { UseShippedScenarios = true };
        await using var client = await server.ConnectClientAsync();
        await client.NextSnapshotAsync();

        // At 1×, worldwide scores every ~15 s or so (see the run-scoremap skill).
        await AdvanceUntilAsync(server, client, "a score change", c => c.Kind == GameChangeKind.ScoreChanged, within: TimeSpan.FromSeconds(30));
    }

    [Fact]
    public async Task Worldwide_has_a_close_basketball_game_coming_into_clutch_time()
    {
        await using var server = new ScoreMapServer { UseShippedScenarios = true };
        await using var client = await server.ConnectClientAsync();
        var snapshot = await client.NextSnapshotAsync();

        var close = Assert.Single(snapshot, g => g.Id == "worldwide-raptors-celtics");
        Assert.Equal((GameStatus.Live, 4, false), (close.Status, close.Period, close.ClutchTime));
        Assert.InRange(Math.Abs((close.Home.Score - close.Away.Score) ?? 99), 0, 5);

        await AdvanceUntilAsync(server, client, $"{close.Id} in clutch time", c => c.Game.Id == close.Id && c.Game.ClutchTime,
            within: TimeSpan.FromMinutes(10));
    }

    [Fact]
    public async Task Crowded_shows_about_40_games_in_and_around_london()
    {
        await using var server = new ScoreMapServer { UseShippedScenarios = true };

        await using var client = await StartAsync(server, "crowded");
        var snapshot = await client.NextSnapshotAsync();

        Assert.InRange(snapshot.Count, 35, 45);
        Assert.All(snapshot, g => Assert.InRange(KmFromCentralLondon(g.Venue), 0, 130));
        Assert.True(snapshot.Count(g => KmFromCentralLondon(g.Venue) < 15) >= 12, "at least 12 games inside London");
    }

    [Fact]
    public async Task Empty_shows_no_games()
    {
        await using var server = new ScoreMapServer { UseShippedScenarios = true };

        await using var client = await StartAsync(server, "empty");

        Assert.Empty(await client.NextSnapshotAsync());
    }

    [Theory]
    [InlineData("worldwide")]
    [InlineData("crowded")]
    public async Task Games_start_finish_get_disrupted_and_drop_out_for_new_ones(string name)
    {
        await using var server = new ScoreMapServer { UseShippedScenarios = true };
        await using var client = await StartAsync(server, name);
        await client.NextSnapshotAsync();

        // New Live games start up to 90% of the way through, so the first finish can take a while.
        var changes = new List<GameChange>();
        foreach (var (waitingFor, wanted) in new (string, Func<GameChange, bool>)[]
        {
            ("a game starting", c => c.Kind == GameChangeKind.Started),
            ("a game finishing", c => c.Kind == GameChangeKind.Finished),
            ("a game disrupted", c => c.Kind == GameChangeKind.Updated && c.Game.Status == GameStatus.Disrupted),
            ("a game dropping out", c => c.Kind == GameChangeKind.Removed),
            ("a new game", c => c.Kind == GameChangeKind.Added),
        })
        {
            if (!changes.Any(wanted))
                changes.AddRange(await AdvanceUntilAsync(server, client, waitingFor, wanted, within: TimeSpan.FromMinutes(30)));
        }
    }

    [Fact]
    public async Task Edge_cases_pin_an_unfindable_venue_at_its_city_and_show_ties_long_names_missing_logos_and_big_scores()
    {
        var reykjavik = new Coordinates(64.1466, -21.9426);
        await using var server = new ScoreMapServer { UseShippedScenarios = true };
        server.Places.Add("Reykjavík, Iceland", reykjavik);

        await using var client = await StartAsync(server, "edge-cases");
        var snapshot = await client.NextSnapshotAsync();

        var unfindable = Assert.Single(snapshot, g => (g.Venue.Latitude, g.Venue.Longitude) == (reykjavik.Latitude, reykjavik.Longitude));
        Assert.Equal($"{unfindable.Venue.Name}, Reykjavík", server.Places.Queries[0]);
        Assert.Contains(snapshot, g => g.Status == GameStatus.Live && g.Home.Score == g.Away.Score);
        Assert.Contains(snapshot, g => g.Home.FullName.Length >= 30 && g.Away.FullName.Length >= 30);
        Assert.Contains(snapshot, g => g.Home.LogoUrl is null && g.Away.LogoUrl is null);
        Assert.Contains(snapshot, g => g.Home.Score >= 100 && g.Away.Score >= 100);
    }

    /// <summary>Switches the running scenario to <paramref name="name"/>, then connects a browser.</summary>
    private static async Task<TestClient> StartAsync(ScoreMapServer server, string name)
    {
        using var http = server.CreateClient();
        (await http.PutAsJsonAsync("/api/scenarios/running", new { name })).EnsureSuccessStatusCode();
        return await server.ConnectClientAsync();
    }

    /// <summary>
    /// Moves the clock on a second at a time, as the poller fetches every second, until the browser
    /// gets a change that is <paramref name="wanted"/>, and returns the changes it got until then.
    /// Fails if there is none <paramref name="within"/> the given time, saying what it was waiting for
    /// (<paramref name="waitingFor"/>, such as "a game finishing") and the kinds of change it saw instead.
    /// </summary>
    private static async Task<List<GameChange>> AdvanceUntilAsync(
        ScoreMapServer server, TestClient client, string waitingFor, Func<GameChange, bool> wanted, TimeSpan within)
    {
        var changes = new List<GameChange>();
        for (var elapsed = TimeSpan.Zero; elapsed < within; elapsed += TimeSpan.FromSeconds(1))
        {
            server.Clock.Advance(TimeSpan.FromSeconds(1));
            await Task.Delay(10);
            changes.AddRange(client.PendingChanges());
            if (changes.Any(wanted))
                return changes;
        }
        // The poller can be behind the clock: give it real time to catch up with the last second.
        try
        {
            while (!changes.Any(wanted))
                changes.Add(await client.NextChangeAsync());
        }
        catch (TimeoutException)
        {
            var seen = changes.Select(c => c.Kind).Distinct().Order().ToList();
            Assert.Fail($"No change for {waitingFor} within {within} of scenario time; saw "
                + (seen.Count > 0 ? string.Join(", ", seen) : "no changes at all"));
        }
        return changes;
    }

    private static double KmFromCentralLondon(GameVenue venue)
    {
        const double lat = 51.5072, lon = -0.1276, radiusKm = 6371;
        double Rad(double degrees) => degrees * Math.PI / 180;
        var dLat = Rad(venue.Latitude - lat);
        var dLon = Rad(venue.Longitude - lon);
        var a = Math.Pow(Math.Sin(dLat / 2), 2) + Math.Cos(Rad(lat)) * Math.Cos(Rad(venue.Latitude)) * Math.Pow(Math.Sin(dLon / 2), 2);
        return 2 * radiusKm * Math.Asin(Math.Sqrt(a));
    }
}
