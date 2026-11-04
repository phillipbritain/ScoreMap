using System.Net.Http.Json;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using Microsoft.Extensions.Time.Testing;
using ScoreMap.Server.GameFeed;
using ScoreMap.Server.Games;
using ScoreMap.Server.Scenarios;
using ScoreMap.Server.Tests.Support;
using ScenarioListing = ScoreMap.Server.Scenarios.ScenarioEndpoints.ScenarioListing;

namespace ScoreMap.Server.Tests.Scenarios;

/// <summary>
/// The scenario files that ship in the repo, run as the owner runs them locally: each shows what
/// its description in the run-scoremap skill says.
/// </summary>
public class ShippedScenarioTests(Xunit.Abstractions.ITestOutputHelper output)
{
    private static readonly string ShippedFolder = Path.Combine(ScenarioVenueListTests.ServerProjectFolder, "Scenarios", "Files");

    [Theory]
    [InlineData("crowded")]
    [InlineData("worldwide")]
    public async Task Live_games_usually_finish_with_regular_finals_and_a_visible_disrupted_share(string name)
    {
        using var server = new ScoreMapServer { UseShippedScenarios = true };
        var scenario = server.Services.GetRequiredService<ScenarioLibrary>().Read(name);
        var clock = new FakeTimeProvider(server.Clock.GetUtcNow());
        var feed = server.Services.GetRequiredService<ScenarioLibrary>().Start(scenario, clock);
        var leagues = server.Services.GetRequiredService<IOptions<List<League>>>().Value;
        async Task<List<ProviderGame>> Snapshot()
        {
            var games = new List<ProviderGame>();
            foreach (var league in leagues)
                games.AddRange(await feed.FetchScoreboardAsync(league.Key, CancellationToken.None));
            return games;
        }
        var initial = await Snapshot();
        var initialFinals = initial.Where(g => g.Status == ProviderStatus.Final).Select(g => g.Id).ToHashSet();
        var live = new HashSet<string>();
        var finals = new HashSet<string>();
        var suspended = new HashSet<string>();
        var disruptedShares = new List<double>();
        TimeSpan? firstFinish = null;
        // The shipped seed is intentional: this guards the owner's repeatable 90-minute run (#253).
        for (var seconds = 0; seconds <= 90 * 60; seconds += 4)
        {
            if (seconds > 0)
                clock.Advance(TimeSpan.FromSeconds(4));
            var games = await Snapshot();
            Assert.Equal(initial.Count, games.Count);
            live.UnionWith(games.Where(g => g.Status == ProviderStatus.InProgress).Select(g => g.Id));
            finals.UnionWith(games.Where(g => g.Status == ProviderStatus.Final && !initialFinals.Contains(g.Id)).Select(g => g.Id));
            suspended.UnionWith(games.Where(g => g.Status == ProviderStatus.Suspended && live.Contains(g.Id)).Select(g => g.Id));
            if (finals.Count > 0)
                firstFinish ??= TimeSpan.FromSeconds(seconds);
            disruptedShares.Add(games.Count(g => g.Status is ProviderStatus.Suspended or ProviderStatus.Postponed or ProviderStatus.Canceled) / (double)games.Count);
        }
        output.WriteLine($"{name}: first {firstFinish}, Finals {finals.Count}, suspensions {suspended.Count}, disrupted {disruptedShares.Average():P2}");
        Assert.NotNull(firstFinish);
        Assert.True(firstFinish <= TimeSpan.FromMinutes(10), $"first finish at {firstFinish}");
        Assert.True(finals.Count >= 18, $"only {finals.Count} new Finals");
        var liveFinals = finals.Count(live.Contains);
        Assert.True(liveFinals > suspended.Count, $"{liveFinals} Live games finished; {suspended.Count} were suspended");
        Assert.InRange(disruptedShares.Average(), scenario.Play!.DisruptedShare * 0.8, scenario.Play.DisruptedShare * 1.2);
    }

    [Fact]
    public async Task Every_scenario_file_in_the_repo_loads_and_worldwide_is_the_default()
    {
        await using var server = new ScoreMapServer { UseShippedScenarios = true };
        using var http = server.CreateClient();

        var listing = await http.GetFromJsonAsync<ScenarioListing>("/api/scenarios");

        Assert.NotNull(listing);
        Assert.Equal("worldwide", listing.Running);
        Assert.Equal(["crowded", "edge-cases", "empty", "hot-finishes", "slow-initial-load", "worldwide"], listing.Scenarios);
        foreach (var name in listing.Scenarios)
        {
            var response = await http.PutAsJsonAsync("/api/scenarios/running", new { name });
            Assert.True(response.IsSuccessStatusCode, $"{name}: {await response.Content.ReadAsStringAsync()}");
        }
    }

    [Theory]
    [InlineData("crowded", true)]
    [InlineData("worldwide", true)]
    [InlineData("slow-initial-load", true)]
    [InlineData("edge-cases", false)]
    [InlineData("empty", false)]
    [InlineData("hot-finishes", false)]
    public async Task Play_can_be_controlled_only_in_the_scenarios_that_play(string name, bool canControlPlay)
    {
        await using var server = new ScoreMapServer { UseShippedScenarios = true };
        using var http = server.CreateClient();

        var response = await http.PutAsJsonAsync("/api/scenarios/running", new { name });

        Assert.Equal(canControlPlay, (await response.Content.ReadFromJsonAsync<ScenarioListing>())?.CanControlPlay);
    }

    // Not slow-initial-load, whose first games wait on the real clock: it fills from worldwide's venues.
    public static TheoryData<string> ScenariosAtListedVenues => new(
        Directory.GetFiles(ShippedFolder, "*.json").Select(Path.GetFileNameWithoutExtension).OfType<string>()
            .Where(name => name is not ("edge-cases" or "slow-initial-load")));

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
        var snapshot = await client.GamesMatchingAsync(games => games.Count >= 140);

        Assert.InRange(snapshot.Count, 140, 160);
        Assert.Equal(Enum.GetValues<GameStatus>().ToHashSet(), snapshot.Select(g => g.Status).ToHashSet());
        Assert.True(snapshot.Select(g => g.Venue.Country).Distinct().Count() >= 20, "games in at least 20 countries");
    }

    [Fact]
    public async Task Worldwide_starts_about_5_percent_of_its_games_disrupted_in_every_way()
    {
        await using var server = new ScoreMapServer { UseShippedScenarios = true };

        await using var client = await server.ConnectClientAsync();
        var snapshot = await client.GamesMatchingAsync(games => games.Count >= 140);

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
    public async Task Worldwide_has_a_close_basketball_game_that_plays_into_its_closing_minutes()
    {
        await using var server = new ScoreMapServer { UseShippedScenarios = true, ScenarioSpeed = Speed.Faster.Name };
        await using var client = await server.ConnectClientAsync();
        var snapshot = await client.GamesMatchingAsync(games => games.Any(g => g.Id == "worldwide-raptors-celtics"));

        var close = Assert.Single(snapshot, g => g.Id == "worldwide-raptors-celtics");
        Assert.Equal((GameStatus.Live, 4, false), (close.Status, close.Period, close.ClutchTime));
        Assert.InRange(Math.Abs(int.Parse(close.Sides().Home.Score!) - int.Parse(close.Sides().Away.Score!)), 0, 5);

        // The score keeps playing at random, so its margin need not stay within five points.
        await AdvanceUntilAsync(server, client, $"{close.Id} in its closing minutes",
            c => c.Game.Id == close.Id && c.Game.Clock is { } clock && clock.StartsWith("Q4 4:", StringComparison.Ordinal),
            within: TimeSpan.FromMinutes(10));
    }

    [Theory]
    [InlineData("worldwide-raptors-celtics")]
    [InlineData("worldwide-chiefs-bills")]
    [InlineData("worldwide-oilers-flames")]
    [InlineData("worldwide-arsenal-chelsea")]
    [InlineData("worldwide-yankees-red-sox")]
    [InlineData("worldwide-mumbai-chennai")]
    public async Task Worldwide_has_a_game_in_each_sport_that_becomes_hot_and_stops(string id)
    {
        await using var server = new ScoreMapServer { UseShippedScenarios = true, ScenarioSpeed = Speed.Faster.Name };
        await using var client = await server.ConnectClientAsync();
        var snapshot = await client.GamesMatchingAsync(games => games.Any(g => g.Id == id));
        Assert.False(Assert.Single(snapshot, g => g.Id == id).Hot);

        await AdvanceUntilAsync(server, client, $"{id} hot", c => c.Game.Id == id && c.Game.Hot, within: TimeSpan.FromMinutes(30));
        await AdvanceUntilAsync(server, client, $"{id} no longer hot", c => c.Game.Id == id && !c.Game.Hot, within: TimeSpan.FromMinutes(30));
    }

    // The sports with a rule for a hot game (see HotGame); one without (tennis, until #219) has none to show.
    private static readonly string[] SportsWithAHotRule = ["Baseball", "Basketball", "Cricket", "Football", "Hockey", "Rugby", "Soccer"];

    [Fact]
    public async Task Worldwide_writes_out_a_game_in_every_sport_with_a_rule_to_become_hot()
    {
        await using var server = new ScoreMapServer { UseShippedScenarios = true };
        await using var client = await server.ConnectClientAsync();
        string[] expected = ["worldwide-raptors-celtics", "worldwide-chiefs-bills", "worldwide-oilers-flames",
            "worldwide-arsenal-chelsea", "worldwide-yankees-red-sox", "worldwide-mumbai-chennai", "worldwide-ireland-france"];
        var snapshot = await client.GamesMatchingAsync(games => expected.All(id => games.Any(g => g.Id == id)));

        var writtenOut = snapshot.Where(g => expected.Contains(g.Id));
        Assert.Equal(SportsWithAHotRule, writtenOut.Select(g => g.Sport).Order());
    }

    [Fact]
    public async Task Hot_finishes_shows_hot_games_in_every_sport_with_a_rule_at_once()
    {
        await using var server = new ScoreMapServer { UseShippedScenarios = true };

        await using var client = await StartAsync(server, "hot-finishes");
        var snapshot = await client.GamesMatchingAsync(games =>
            SportsWithAHotRule.All(sport => games.Count(g => g.Sport == sport) >= 4));

        Assert.All(snapshot, game => Assert.True(game.Hot, $"{game.Id} is hot"));
        Assert.All(snapshot.GroupBy(g => g.Sport), sport => Assert.True(sport.Count() >= 4, $"{sport.Key}: {sport.Count()} games"));
        Assert.Equal(SportsWithAHotRule, snapshot.Select(g => g.Sport).Distinct().Order());
    }

    [Fact]
    public async Task Crowded_shows_about_40_games_packed_into_big_cities_around_the_world()
    {
        await using var server = new ScoreMapServer { UseShippedScenarios = true };

        await using var client = await StartAsync(server, "crowded");
        var snapshot = await client.GamesMatchingAsync(games =>
            games.Count >= 35 && games.All(g => g.Venue.Latitude is not null));

        Assert.InRange(snapshot.Count, 35, 45);
        // Which cities a fill picks is up to its seed (the venue list's tests check the group spans them all).
        var byCity = snapshot.GroupBy(g => Assert.Single(BigCities, city => KmFrom(city.At, g.Venue) < 60).Name).ToList();
        Assert.True(byCity.Count >= 5, $"games in {byCity.Count} cities");
        Assert.True(byCity.Any(city => city.Count() >= 8), "at least 8 games in one city");
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
        await using var server = new ScoreMapServer { UseShippedScenarios = true, ScenarioSpeed = Speed.Faster.Name };
        await using var client = await StartAsync(server, name);
        await client.NextSnapshotAsync();

        // The sustained feed regression above checks finish frequency; this checks delivery to a browser.
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
                changes.AddRange(await AdvanceUntilAsync(server, client, waitingFor, wanted, within: TimeSpan.FromMinutes(10)));
        }
    }

    [Fact]
    public async Task Edge_cases_pin_an_unfindable_venue_at_its_city_and_show_ties_long_names_missing_logos_and_big_scores()
    {
        var reykjavik = new Coordinates(64.1466, -21.9426);
        await using var server = new ScoreMapServer { UseShippedScenarios = true };
        server.Places.Add("Reykjavík, Iceland", reykjavik);

        await using var client = await StartAsync(server, "edge-cases");
        string[] expected = ["edge-unfindable-venue", "edge-tied-score", "edge-long-names", "edge-missing-logos", "edge-three-digit-scores"];
        var snapshot = await client.GamesMatchingAsync(games => expected.All(id => games.Any(g => g.Id == id))
            && games.Any(g => (g.Venue.Latitude, g.Venue.Longitude) == (reykjavik.Latitude, reykjavik.Longitude)));

        var unfindable = Assert.Single(snapshot, g => (g.Venue.Latitude, g.Venue.Longitude) == (reykjavik.Latitude, reykjavik.Longitude));
        Assert.Equal($"{unfindable.Venue.Name}, Reykjavík", server.Places.Queries[0]);
        var twoSided = snapshot.Where(g => g.Contest is GameSides).ToList();
        Assert.Contains(twoSided, g => g.Status == GameStatus.Live && g.Sides().Home.Score == g.Sides().Away.Score);
        Assert.Contains(twoSided, g => g.Sides().Home.FullName.Length >= 30 && g.Sides().Away.FullName.Length >= 30);
        Assert.Contains(twoSided, g => g.Sides().Home.LogoUrl is null && g.Sides().Away.LogoUrl is null);
        Assert.Contains(twoSided, g => Points(g.Sides().Home.Score) >= 100 && Points(g.Sides().Away.Score) >= 100);
    }

    [Fact]
    public async Task Edge_cases_show_a_NASCAR_race_under_way_with_its_whole_field_and_one_yet_to_list_its_field()
    {
        await using var server = new ScoreMapServer { UseShippedScenarios = true };

        await using var client = await StartAsync(server, "edge-cases");
        var races = (await client.GamesMatchingAsync(games => games.Count(g => g.League == "NASCAR Cup Series") == 2)).Where(g => g.League == "NASCAR Cup Series").ToList();

        var live = Assert.Single(races, g => g.Status == GameStatus.Live);
        Assert.Equal("Racing", live.Sport);
        Assert.StartsWith("Lap ", live.Clock);
        var field = Assert.IsType<GameField>(live.Contest);
        Assert.True(field.Entries.Count > 10, "a field longer than the game panel's top 10");
        Assert.Equal(Enumerable.Range(1, field.Entries.Count), field.Entries.Select(entrant => entrant.Position));
        Assert.Equal("Los Angeles Memorial Coliseum", live.Venue.Name);
        var upcoming = Assert.Single(races, g => g.Status == GameStatus.Upcoming);
        Assert.Empty(Assert.IsType<GameField>(upcoming.Contest).Entries);
        Assert.NotNull(upcoming.Note);
    }

    [Fact]
    public async Task Edge_cases_show_an_F1_race_under_way_with_its_whole_field()
    {
        await using var server = new ScoreMapServer { UseShippedScenarios = true };

        await using var client = await StartAsync(server, "edge-cases");
        var race = await client.GameMatchingAsync(g => g.League == "Formula 1");

        Assert.Equal(GameStatus.Live, race.Status);
        Assert.Equal("Racing", race.Sport);
        Assert.Equal("Lap 42", race.Clock);
        var field = Assert.IsType<GameField>(race.Contest);
        Assert.Equal(Enumerable.Range(1, 22), field.Entries.Select(entrant => entrant.Position));
        Assert.Equal("Hard Rock Stadium", race.Venue.Name);
    }

    [Fact]
    public async Task Edge_cases_show_a_golf_tournament_hot_in_its_final_round_with_scores_to_par_and_ties()
    {
        await using var server = new ScoreMapServer { UseShippedScenarios = true };

        await using var client = await StartAsync(server, "edge-cases");
        var tournament = await client.GameMatchingAsync(g => g.League == "PGA Tour");

        Assert.Equal((GameStatus.Live, "Golf", "R4 · Thru 12", true), (tournament.Status, tournament.Sport, tournament.Clock, tournament.Hot));
        var field = Assert.IsType<GameField>(tournament.Contest);
        Assert.True(field.Entries.Count > 10, "a field longer than the game panel's top 10");
        Assert.Equal([(1, "-15"), (2, "-14"), (2, "-14")], field.Entries.Take(3).Select(entrant => (entrant.Position, entrant.Score)));
        Assert.Contains(field.Entries, entrant => entrant.Score == "E");
        Assert.Equal("Rose Bowl", tournament.Venue.Name);
    }


    [Fact]
    public async Task Edge_cases_show_a_UFC_fight_card_under_way_with_every_bout_main_event_first()
    {
        await using var server = new ScoreMapServer { UseShippedScenarios = true };

        await using var client = await StartAsync(server, "edge-cases");
        var card = await client.GameMatchingAsync(g => g.League == "UFC");

        Assert.Equal((GameStatus.Live, "MMA", "R2", false), (card.Status, card.Sport, card.Clock, card.Hot));
        Assert.Equal("Madison Square Garden", card.Venue.Name);
        var bouts = Assert.IsType<GameBouts>(card.Contest).Bouts;
        Assert.Equal(("Jon Jones", GameStatus.Live, 5), (bouts[0].First.Name, bouts[0].Status, bouts[0].ScheduledRounds));
        Assert.All(bouts.Skip(1), bout => Assert.Equal(GameStatus.Final, bout.Status));
        Assert.Equal(["Decision", "KO/TKO", "Submission"], bouts.Select(bout => bout.Method).OfType<string>().Distinct().Order());
        Assert.Contains(bouts, bout => bout.Status == GameStatus.Final && bout.Method is null && !bout.First.Winner && !bout.Second.Winner);
    }

    /// <summary>A score in points, goals or runs; null for none, or for a cricket score with wickets.</summary>
    private static int? Points(string? score) => int.TryParse(score, out var points) ? points : null;

    /// <summary>Switches the running scenario to <paramref name="name"/>, then connects a browser.</summary>
    private static async Task<TestClient> StartAsync(ScoreMapServer server, string name)
    {
        using var http = server.CreateClient();
        (await http.PutAsJsonAsync("/api/scenarios/running", new { name })).EnsureSuccessStatusCode();
        return await server.ConnectClientAsync();
    }

    /// <summary>
    /// Moves the real clock on 250 ms at a time, so the poller fetches once a step at Fast and Faster
    /// (it fetches every second divided by the speed, but no more often than every 250 ms), and so
    /// a game Final for a minute of scenario time is seen finishing before it drops out, until the browser gets a change that is <paramref name="wanted"/>, and returns
    /// the changes it got until then. Fails if there is none <paramref name="within"/> the given
    /// scenario time, saying what it was waiting for (<paramref name="waitingFor"/>, such as "a game
    /// finishing") and the kinds of change it saw instead. Each step covers 250 ms of scenario time
    /// times the speed, so a test waiting long runs its scenario at Faster.
    /// </summary>
    private static async Task<List<GameChange>> AdvanceUntilAsync(
        ScoreMapServer server, TestClient client, string waitingFor, Func<GameChange, bool> wanted, TimeSpan within)
    {
        var realStep = TimeSpan.FromMilliseconds(250);
        var step = realStep * server.Services.GetRequiredService<ScenarioSwitcher>().Speed.Times;
        var changes = new List<GameChange>();
        for (var elapsed = TimeSpan.Zero; elapsed < within; elapsed += step)
        {
            server.Clock.Advance(realStep);
            // Waits for the step's fetches to send their changes (there are nearly always some, as clocks run)
            // and then go quiet, so the clock never runs on ahead of the poller, and a game can't finish and
            // drop out between two fetches of its league.
            for (var wait = TimeSpan.FromMilliseconds(500); await client.ChangeArrivedAsync(wait); wait = TimeSpan.FromMilliseconds(25))
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

    // The centres of the cities crowded packs its games into.
    private static readonly (string Name, (double Lat, double Lon) At)[] BigCities =
    [
        ("New York", (40.7128, -74.0060)), ("Los Angeles", (34.0522, -118.2437)), ("Miami", (25.7617, -80.1918)),
        ("London", (51.5072, -0.1276)), ("Paris", (48.8566, 2.3522)), ("Tokyo", (35.6762, 139.6503)),
        ("Madrid", (40.4168, -3.7038)), ("Mexico City", (19.4326, -99.1332)), ("São Paulo", (-23.5505, -46.6333)),
        ("Buenos Aires", (-34.6037, -58.3816)), ("Istanbul", (41.0082, 28.9784)), ("Cairo", (30.0444, 31.2357)),
        ("Seoul", (37.5665, 126.9780)), ("Mumbai", (19.0760, 72.8777)), ("Shanghai", (31.2304, 121.4737)),
        ("Lagos", (6.5244, 3.3792)), ("Jakarta", (-6.2088, 106.8456)),
    ];

    private static double KmFrom((double Lat, double Lon) centre, GameVenue venue)
    {
        var (lat, lon) = centre;
        var (venueLat, venueLon) = (venue.Latitude!.Value, venue.Longitude!.Value);
        const double radiusKm = 6371;
        double Rad(double degrees) => degrees * Math.PI / 180;
        var dLat = Rad(venueLat - lat);
        var dLon = Rad(venueLon - lon);
        var a = Math.Pow(Math.Sin(dLat / 2), 2) + Math.Cos(Rad(lat)) * Math.Cos(Rad(venueLat)) * Math.Pow(Math.Sin(dLon / 2), 2);
        return 2 * radiusKm * Math.Asin(Math.Sqrt(a));
    }
}
