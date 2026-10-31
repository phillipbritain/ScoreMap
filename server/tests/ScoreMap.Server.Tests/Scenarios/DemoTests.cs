using System.Net;
using System.Net.Http.Json;
using ScoreMap.Server.Games;
using ScoreMap.Server.Scenarios;
using ScoreMap.Server.Tests.Support;
using ScenarioListing = ScoreMap.Server.Scenarios.ScenarioEndpoints.ScenarioListing;
using static ScoreMap.Server.Tests.Support.TestGames;

namespace ScoreMap.Server.Tests.Scenarios;

/// <summary>
/// Demos (ADR-0019): a browser that opens one watches the worldwide scenario on a demo board of its own,
/// shared by every demo viewer, while everyone else watches what they did before.
/// </summary>
public class DemoTests
{
    // Stands in for worldwide: one Live game that scores at 1m, on a timeline long enough not to loop in any test.
    private const string ScoresAtOneMinute = """
        {
          "games": [
            {
              "id": "chiefs-bills",
              "league": "NFL",
              "home": { "name": "Kansas City Chiefs", "abbreviation": "KC", "score": 14 },
              "away": { "name": "Buffalo Bills", "abbreviation": "BUF", "score": 10 },
              "venue": { "name": "Arrowhead Stadium", "city": "Kansas City", "region": "MO", "country": "USA" },
              "startsIn": "-40m",
              "status": "live"
            }
          ],
          "timeline": {
            "length": "1h",
            "changes": [ { "at": "1m", "game": "chiefs-bills", "score": { "home": 21 } } ]
          }
        }
        """;

    private static ScoreMapServer DemoServer(string? environment = null, string? scenario = null, string? speed = null)
    {
        var server = new ScoreMapServer { Environment = environment, Scenario = scenario, ScenarioSpeed = speed };
        server.WriteScenario(DemoBoard.Scenario, ScoresAtOneMinute);
        return server;
    }

    private static string? HomeScore(IReadOnlyList<Game> games) => Assert.Single(games).Sides().Home.Score;

    [Fact]
    public async Task A_demo_viewer_gets_the_worldwide_scenarios_games_and_everyone_else_the_real_games()
    {
        await using var server = DemoServer();
        server.Feed.SetScoreboard(Nfl, LiveGame(server.Clock, "real-game"));

        await using var demo = await server.ConnectClientAsync(demo: true);
        await using var real = await server.ConnectClientAsync();

        Assert.Equal("chiefs-bills", Assert.Single(await demo.NextSnapshotAsync()).Id);
        Assert.Equal("real-game", Assert.Single(await real.NextSnapshotAsync()).Id);
    }

    [Fact]
    public async Task Every_demo_viewer_watches_the_same_games_and_the_others_hear_nothing_of_them()
    {
        await using var server = DemoServer();
        await using var first = await server.ConnectClientAsync(demo: true);
        await first.NextSnapshotAsync();
        await using var real = await server.ConnectClientAsync();
        await real.NextSnapshotAsync();
        server.Clock.Advance(TimeSpan.FromSeconds(30));
        await using var second = await server.ConnectClientAsync(demo: true);
        await second.NextSnapshotAsync();

        server.Clock.Advance(TimeSpan.FromSeconds(30));

        foreach (var viewer in new[] { first, second })
        {
            var change = await viewer.NextChangeAsync();
            Assert.Equal((GameChangeKind.ScoreChanged, "21"), (change.Kind, change.Game.Sides().Home.Score));
        }
        Assert.Empty(real.PendingChanges());
    }

    [Fact]
    public async Task A_demo_plays_at_Normal_whatever_the_pills_scenario_and_speed()
    {
        await using var server = DemoServer(scenario: "other", speed: "Faster");
        server.WriteScenario("other", ScoresAtOneMinute.Replace("chiefs-bills", "other-game"));
        await using var demo = await server.ConnectClientAsync(demo: true);
        await demo.NextSnapshotAsync();

        // At Faster, a minute of the pill's scenario passes in under 2 s.
        server.Clock.Advance(TimeSpan.FromSeconds(2));
        await Task.Delay(100);
        Assert.Empty(demo.PendingChanges());
        server.Clock.Advance(TimeSpan.FromSeconds(58));

        Assert.Equal("21", (await demo.NextChangeAsync()).Game.Sides().Home.Score);
    }

    [Fact]
    public async Task Switching_the_pills_scenario_leaves_a_demo_as_it_was()
    {
        await using var server = DemoServer(scenario: "other");
        server.WriteScenario("other", ScoresAtOneMinute.Replace("chiefs-bills", "other-game"));
        await using var demo = await server.ConnectClientAsync(demo: true);
        await demo.NextSnapshotAsync();
        await using var real = await server.ConnectClientAsync();
        await real.NextSnapshotAsync();
        using var http = server.CreateClient();

        (await http.PutAsJsonAsync("/api/scenarios/running", new { name = "real" })).EnsureSuccessStatusCode();

        Assert.Equal(GameChangeKind.Removed, (await real.NextChangeAsync()).Kind);
        Assert.Equal("real", (await real.NextScenarioChangeAsync()).Running);
        await Task.Delay(100);
        Assert.Empty(demo.PendingChanges());
    }

    [Fact]
    public async Task On_the_live_site_a_demo_shows_its_games_while_the_scenario_endpoints_stay_closed()
    {
        await using var server = DemoServer(environment: "Production");
        server.Feed.SetScoreboard(Nfl, LiveGame(server.Clock, "real-game"));
        using var http = server.CreateClient();

        await using var demo = await server.ConnectClientAsync(demo: true);
        await using var real = await server.ConnectClientAsync();

        Assert.Equal("chiefs-bills", Assert.Single(await demo.NextSnapshotAsync()).Id);
        Assert.Equal("real-game", Assert.Single(await real.NextSnapshotAsync()).Id);
        Assert.Empty((await http.GetFromJsonAsync<ScenarioListing>("/api/scenarios"))!.Scenarios);
        var switched = await http.PutAsJsonAsync("/api/scenarios/running", new { name = DemoBoard.Scenario });
        Assert.Equal(HttpStatusCode.NotFound, switched.StatusCode);
        var sped = await http.PutAsJsonAsync("/api/scenarios/speed", new { speed = "Fast" });
        Assert.Equal(HttpStatusCode.NotFound, sped.StatusCode);
    }

    [Fact]
    public async Task On_the_live_site_a_demo_shows_the_shipped_worldwide_scenario()
    {
        await using var server = new ScoreMapServer { Environment = "Production", UseShippedScenarios = true };

        var games = await server.SnapshotOnceAsync(demo: true);

        Assert.Contains(games, game => game.Id == "worldwide-raptors-celtics");
        Assert.True(games.Count > 100, $"Only {games.Count} games");
    }

    [Fact]
    public async Task A_viewer_back_within_a_minute_finds_the_demo_where_it_was()
    {
        await using var server = DemoServer();
        Assert.Equal("14", HomeScore(await server.SnapshotOnceAsync(demo: true)));
        server.Clock.Advance(TimeSpan.FromSeconds(59));
        Assert.Equal("14", HomeScore(await server.SnapshotOnceAsync(demo: true)));

        server.Clock.Advance(TimeSpan.FromSeconds(59));

        Assert.Equal("21", HomeScore(await server.SnapshotOnceAsync(demo: true)));
    }

    [Fact]
    public async Task A_minute_after_the_last_viewer_leaves_the_demo_stops_and_the_next_one_starts_it_afresh()
    {
        await using var server = DemoServer();
        await server.SnapshotOnceAsync(demo: true);
        server.Clock.Advance(TimeSpan.FromSeconds(30));
        await server.SnapshotOnceAsync(demo: true);

        // 90 s on the scenario clock had the demo carried on, but it stopped a minute after the viewer left.
        server.Clock.Advance(TimeSpan.FromMinutes(1));
        await using var next = await server.ConnectClientAsync(demo: true);

        Assert.Equal("14", HomeScore(await next.NextSnapshotAsync()));
        server.Clock.Advance(TimeSpan.FromMinutes(1));
        Assert.Equal("21", (await next.NextChangeAsync()).Game.Sides().Home.Score);
    }
}
