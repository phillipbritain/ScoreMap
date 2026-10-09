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

    private sealed record ScenarioListing(string Running, string[] Scenarios);

    [Fact]
    public async Task Every_scenario_file_in_the_repo_loads_and_worldwide_is_the_default()
    {
        await using var server = new ScoreMapServer { UseShippedScenarios = true };
        using var http = server.CreateClient();

        var listing = await http.GetFromJsonAsync<ScenarioListing>("/api/scenarios");

        Assert.NotNull(listing);
        Assert.Equal("worldwide", listing.Running);
        Assert.Superset(
            new HashSet<string> { "worldwide", "crowded", "live-scoring", "busy", "lifecycle", "disrupted", "empty", "edge-cases" },
            listing.Scenarios.ToHashSet());
        foreach (var name in listing.Scenarios)
        {
            var response = await http.PutAsJsonAsync("/api/scenarios/running", new { name });
            Assert.True(response.IsSuccessStatusCode, $"{name}: {await response.Content.ReadAsStringAsync()}");
        }
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
    public async Task Live_scoring_changes_a_score_within_10_seconds_and_has_a_break_and_a_finish_in_each_loop()
    {
        await using var server = new ScoreMapServer { UseShippedScenarios = true };
        await using var client = await StartAsync(server, "live-scoring");
        var snapshot = await client.NextSnapshotAsync();
        Assert.True(snapshot.Where(g => g.Status == GameStatus.Live).Select(g => g.Sport).Distinct().Count() >= 3,
            "live games in at least 3 sports");

        await AdvanceUntilAsync(server, client, c => c.Kind == GameChangeKind.ScoreChanged, within: TimeSpan.FromSeconds(10));

        var loop = await AdvanceUntilAsync(server, client, c => c.Kind == GameChangeKind.Added, within: TimeSpan.FromMinutes(3));
        Assert.Contains(loop, c => c.Kind == GameChangeKind.Finished);
        Assert.Contains(loop, c => IsBreak(c.Game.Clock));
    }

    [Fact]
    public async Task Lifecycle_takes_one_game_from_upcoming_to_live_to_a_break_and_back_to_final()
    {
        await using var server = new ScoreMapServer { UseShippedScenarios = true };
        await using var client = await StartAsync(server, "lifecycle");
        var game = Assert.Single(await client.NextSnapshotAsync());
        Assert.Equal(GameStatus.Upcoming, game.Status);

        var changes = await AdvanceUntilAsync(server, client, c => c.Kind == GameChangeKind.Finished, within: TimeSpan.FromMinutes(3));

        var states = changes.Select(c => (c.Game.Status, Break: IsBreak(c.Game.Clock)))
            .Prepend((game.Status, Break: false))
            .ToList();
        var inTurn = states.Where((state, i) => i == 0 || state != states[i - 1]); // each state once, in the order seen
        Assert.Equal(
            [(GameStatus.Upcoming, false), (GameStatus.Live, false), (GameStatus.Live, true), (GameStatus.Live, false), (GameStatus.Final, false)],
            inTurn);
    }

    [Fact]
    public async Task Disrupted_shows_postponed_suspended_and_canceled_games_next_to_normal_ones()
    {
        await using var server = new ScoreMapServer { UseShippedScenarios = true };

        await using var client = await StartAsync(server, "disrupted");
        var snapshot = await client.NextSnapshotAsync();

        Assert.Equal(Enum.GetValues<Disruption>().ToHashSet(), snapshot.Select(g => g.Disruption).OfType<Disruption>().ToHashSet());
        Assert.Contains(snapshot, g => g.Status == GameStatus.Live);
        Assert.Contains(snapshot, g => g.Status == GameStatus.Upcoming);
    }

    [Fact]
    public async Task Empty_shows_no_games()
    {
        await using var server = new ScoreMapServer { UseShippedScenarios = true };

        await using var client = await StartAsync(server, "empty");

        Assert.Empty(await client.NextSnapshotAsync());
    }

    [Fact]
    public async Task Busy_shows_about_60_live_games_that_score_by_themselves()
    {
        await using var server = new ScoreMapServer { UseShippedScenarios = true };
        await using var client = await StartAsync(server, "busy");
        var snapshot = await client.NextSnapshotAsync();

        Assert.InRange(snapshot.Count, 55, 65);
        Assert.All(snapshot, g => Assert.Equal(GameStatus.Live, g.Status));
        // At 1×, busy scores every ~15 s or so (see the run-scoremap skill).
        await AdvanceUntilAsync(server, client, c => c.Kind == GameChangeKind.ScoreChanged, within: TimeSpan.FromSeconds(30));
    }

    [Theory]
    [InlineData("worldwide")]
    [InlineData("crowded")]
    [InlineData("disrupted")]
    public async Task Live_games_move_on_by_themselves_and_no_game_starts_or_finishes(string name)
    {
        await using var server = new ScoreMapServer { UseShippedScenarios = true };
        await using var client = await StartAsync(server, name);
        await client.NextSnapshotAsync();

        var changes = await AdvanceUntilAsync(server, client, c => c.Kind == GameChangeKind.Updated && c.Game.Status == GameStatus.Live,
            within: TimeSpan.FromSeconds(10));

        Assert.DoesNotContain(changes, c => c.Kind is GameChangeKind.Started or GameChangeKind.Finished);
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
    /// Fails if there is none <paramref name="within"/> the given time.
    /// </summary>
    private static async Task<List<GameChange>> AdvanceUntilAsync(
        ScoreMapServer server, TestClient client, Func<GameChange, bool> wanted, TimeSpan within)
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
        while (!changes.Any(wanted))
            changes.Add(await client.NextChangeAsync());
        return changes;
    }

    private static bool IsBreak(string? clock) => clock is "HT" or "Halftime" || clock?.StartsWith("End ") == true;

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
