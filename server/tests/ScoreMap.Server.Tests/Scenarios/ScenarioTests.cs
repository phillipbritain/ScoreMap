using Microsoft.Extensions.DependencyInjection;
using ScoreMap.Server.Games;
using ScoreMap.Server.Scenarios;
using ScoreMap.Server.Tests.Support;
using static ScoreMap.Server.Tests.Support.TestGames;

namespace ScoreMap.Server.Tests.Scenarios;

public class ScenarioTests
{
    private const string OneLiveGame = """
        {
          "games": [
            {
              "id": "chiefs-bills",
              "league": "NFL",
              "home": { "name": "Kansas City Chiefs", "abbreviation": "KC", "logo": "https://a.espncdn.com/i/teamlogos/nfl/500/kc.png", "score": 14 },
              "away": { "name": "Buffalo Bills", "abbreviation": "BUF", "score": 10 },
              "venue": { "name": "Arrowhead Stadium", "city": "Kansas City", "region": "MO", "country": "USA" },
              "startsIn": "-40m",
              "status": "live",
              "clock": "8:12",
              "period": 2
            }
          ]
        }
        """;

    [Fact]
    public async Task With_a_scenario_set_the_browser_gets_the_scenarios_games_instead_of_real_ones()
    {
        await using var server = new ScoreMapServer { Scenario = "test" };
        server.WriteScenario("test", OneLiveGame);
        server.Feed.SetScoreboard(Nfl, LiveGame(server.Clock, "real-game"));

        await using var client = await server.ConnectClientAsync();
        var snapshot = await client.NextSnapshotAsync();

        var game = Assert.Single(snapshot);
        Assert.Equal("chiefs-bills", game.Id);
        Assert.Equal("NFL", game.League);
        Assert.Equal(GameStatus.Live, game.Status);
        Assert.Equal(new GameTeam("KC", "Kansas City Chiefs", "https://a.espncdn.com/i/teamlogos/nfl/500/kc.png", 14), game.Home);
        Assert.Equal(new GameTeam("BUF", "Buffalo Bills", null, 10), game.Away);
        Assert.Equal("Arrowhead Stadium", game.Venue.Name);
        Assert.Equal("Kansas City", game.Venue.City);
        Assert.Equal(2, game.Period);
        Assert.Equal(server.Clock.GetUtcNow().AddMinutes(-40), game.StartTime);
        Assert.Equal(0, server.Feed.Fetches(Nfl));
    }

    [Fact]
    public async Task Game_starts_are_relative_to_when_the_scenario_started_and_every_league_is_fetched_every_second()
    {
        await using var server = new ScoreMapServer { Scenario = "test" };
        // Upcoming games get their pin 3 h before their start: this one 1 s after the scenario starts.
        server.WriteScenario("test", """
            {
              "games": [
                {
                  "id": "later",
                  "league": "Premier League",
                  "home": { "name": "Arsenal", "abbreviation": "ARS" },
                  "away": { "name": "Chelsea", "abbreviation": "CHE" },
                  "venue": { "name": "Emirates Stadium", "city": "London", "country": "England" },
                  "startsIn": "3h0m1s",
                  "status": "upcoming"
                }
              ]
            }
            """);
        var startedAt = server.Clock.GetUtcNow();
        await using var client = await server.ConnectClientAsync();
        Assert.Empty(await client.NextSnapshotAsync());

        server.Clock.Advance(TimeSpan.FromSeconds(1));
        var change = await client.NextChangeAsync();

        Assert.Equal(GameChangeKind.Added, change.Kind);
        Assert.Equal("later", change.Game.Id);
        Assert.Equal(GameStatus.Upcoming, change.Game.Status);
        Assert.Equal(startedAt + new TimeSpan(3, 0, 1), change.Game.StartTime);
    }

    [Fact]
    public async Task Run_locally_the_server_starts_on_the_default_scenario_with_games_in_several_leagues_and_statuses()
    {
        await using var server = new ScoreMapServer { UseShippedScenarios = true };
        server.Feed.SetScoreboard(Nfl, LiveGame(server.Clock, "real-game"));

        await using var client = await server.ConnectClientAsync();
        var snapshot = await client.NextSnapshotAsync();

        Assert.DoesNotContain(snapshot, g => g.Id == "real-game");
        Assert.True(snapshot.Select(g => g.League).Distinct().Count() >= 3, "games in at least 3 leagues");
        Assert.True(snapshot.Select(g => g.Status).Distinct().Count() >= 3, "games in at least 3 statuses");
    }

    [Fact]
    public async Task A_browser_gets_each_scripted_change_at_its_time_and_fresh_games_when_the_timeline_starts_again()
    {
        await using var server = new ScoreMapServer { Scenario = "test" };
        server.WriteScenario("test", OneLiveGame.TrimEnd().TrimEnd('}') + """
            ,
              "timeline": {
                "length": "30s",
                "changes": [
                  { "at": "10s", "game": "chiefs-bills", "score": { "home": 21 } },
                  { "at": "20s", "game": "chiefs-bills", "status": "final" }
                ]
              }
            }
            """);
        await using var client = await server.ConnectClientAsync();
        Assert.Equal(14, Assert.Single(await client.NextSnapshotAsync()).Home.Score);

        server.Clock.Advance(TimeSpan.FromSeconds(9));
        await Task.Delay(100);
        Assert.Empty(client.PendingChanges());
        server.Clock.Advance(TimeSpan.FromSeconds(1));
        var scored = await client.NextChangeAsync();
        Assert.Equal(GameChangeKind.ScoreChanged, scored.Kind);
        Assert.Equal(21, scored.Game.Home.Score);

        server.Clock.Advance(TimeSpan.FromSeconds(10));
        var finished = await client.NextChangeAsync();
        Assert.Equal(GameChangeKind.Finished, finished.Kind);
        Assert.Equal("chiefs-bills", finished.Game.Id);

        server.Clock.Advance(TimeSpan.FromSeconds(10));
        var restarted = new[] { await client.NextChangeAsync(), await client.NextChangeAsync() };
        var removed = Assert.Single(restarted, c => c.Kind == GameChangeKind.Removed);
        Assert.Equal("chiefs-bills", removed.Game.Id);
        var added = Assert.Single(restarted, c => c.Kind == GameChangeKind.Added);
        Assert.NotEqual("chiefs-bills", added.Game.Id);
        Assert.Equal(GameStatus.Live, added.Game.Status);
        Assert.Equal(14, added.Game.Home.Score);
    }

    [Fact]
    public async Task A_browser_gets_every_filled_game_at_a_different_venue_in_the_group_with_its_home_team()
    {
        await using var server = new ScoreMapServer { Scenario = "test" };
        server.WriteScenario("test", """{ "fill": { "count": 10, "group": "london", "mix": { "live": 4, "upcoming": 2, "final": 2, "disrupted": 2 } } }""");
        var london = ShippedVenues().Where(v => v.Groups.Contains("london")).ToList();

        await using var client = await server.ConnectClientAsync();
        var snapshot = await client.NextSnapshotAsync();

        Assert.Equal(10, snapshot.Count);
        Assert.Equal(10, snapshot.Select(g => g.Venue.Name).Distinct().Count());
        Assert.All(snapshot, game =>
        {
            var venue = Assert.Single(london, v => v.Name == game.Venue.Name);
            Assert.Equal(venue.HomeTeam.Name, game.Home.FullName);
        });
        Assert.Equal(
            [(GameStatus.Upcoming, 2), (GameStatus.Live, 4), (GameStatus.Final, 2), (GameStatus.Disrupted, 2)],
            snapshot.GroupBy(g => g.Status).OrderBy(g => g.Key).Select(g => (g.Key, g.Count())));
    }

    [Fact]
    public async Task Every_game_filled_from_the_whole_venue_list_shows_in_every_status()
    {
        var count = ShippedVenues().Count(v => v.Groups.Contains("worldwide"));
        await using var server = new ScoreMapServer { Scenario = "test" };
        server.WriteScenario("test", $$"""{ "fill": { "count": {{count}}, "group": "worldwide", "mix": { "live": 1, "upcoming": 1, "final": 1, "disrupted": 1 } } }""");

        await using var client = await server.ConnectClientAsync();
        var snapshot = await client.NextSnapshotAsync();

        Assert.Equal(count, snapshot.Count);
        Assert.Equal(4, snapshot.Select(g => g.Status).Distinct().Count());
    }

    [Fact]
    public async Task With_random_play_a_browser_sees_live_games_score_by_themselves()
    {
        await using var server = new ScoreMapServer { Scenario = "test" };
        server.WriteScenario("test", """{ "fill": { "count": 20, "group": "worldwide" }, "play": "random" }""");
        await using var client = await server.ConnectClientAsync();
        var snapshot = await client.NextSnapshotAsync();

        server.Clock.Advance(TimeSpan.FromSeconds(30));

        GameChange change;
        do change = await client.NextChangeAsync();
        while (change.Kind != GameChangeKind.ScoreChanged);
        var before = snapshot.Single(g => g.Id == change.Game.Id);
        Assert.True(change.Game.Home.Score + change.Game.Away.Score > before.Home.Score + before.Away.Score);
    }

    private static IReadOnlyList<ScenarioVenue> ShippedVenues() =>
        ScenarioVenue.ReadList(Path.Combine(ScenarioVenueListTests.ServerProjectFolder, "scenario-venues.json"));

    [Theory]
    [InlineData("""{ "fill": { "count": 2, "group": "atlantis" } }""", "fill", "unknown group \"atlantis\"")]
    [InlineData("""{ "fill": { "count": 1000, "group": "london" } }""", "fill", "asks for 1000 games from \"london\"")]
    [InlineData("""{ "games": [ { "league": "NFLL", "home": { "name": "A", "abbreviation": "A" }, "away": { "name": "B", "abbreviation": "B" }, "venue": { "name": "Somewhere", "city": "Town" }, "startsIn": "0", "status": "upcoming" } ] }""",
        "game 1", "unknown league \"NFLL\"")]
    [InlineData("""{ "games": [ { "league": "NFL", "home": { "name": "A", "abbreviation": "A" }, "away": { "name": "B", "abbreviation": "B" }, "startsIn": "0", "status": "upcoming" } ] }""",
        "game 1", "no venue")]
    [InlineData("""{ "games": [ { "league": "NFL", "home": { "name": "A", "abbreviation": "A" }, "away": { "name": "B", "abbreviation": "B" }, "venue": { "city": "Town" }, "startsIn": "0", "status": "upcoming" } ] }""",
        "game 1", "no venue")]
    [InlineData("""{ "games": [ { "league": "NFL", "home": { "name": "A", "abbreviation": "A" }, "away": { "name": "B", "abbreviation": "B" }, "venue": { "name": "Arowhead Stadium", "city": "Kansas City" }, "startsIn": "0", "status": "upcoming" } ] }""",
        "game 1", "unknown venue \"Arowhead Stadium\"", "notInVenueList")]
    [InlineData("""{ "games": [ { "league": "NFL", """, "isn't valid JSON")]
    [InlineData("""{ "games": [ { "league": "NFL", "home": { "name": "A", "abbreviation": "A" }, "away": { "name": "B", "abbreviation": "B" }, "venue": { "name": "Somewhere", "city": "Town" }, "startsIn": "soon", "status": "upcoming" } ] }""",
        "game 1", "startsIn \"soon\"")]
    [InlineData("""{ "games": [ { "league": "NFL", "home": { "name": "A", "abbreviation": "A" }, "away": { "name": "B", "abbreviation": "B" }, "venue": { "name": "Somewhere", "city": "Town" }, "startsIn": "0", "status": "playing" } ] }""",
        "game 1", "unknown status \"playing\"")]
    [InlineData("""{ "games": [ { "league": "NFL", "away": { "name": "B", "abbreviation": "B" }, "venue": { "name": "Somewhere", "city": "Town" }, "startsIn": "0", "status": "upcoming" } ] }""",
        "game 1", "no home team")]
    [InlineData("""{ "games": [], "timeline": { "length": "1m", "changes": [ { "at": "10s", "game": "nobody", "status": "live" } ] } }""",
        "timeline change 1", "unknown game \"nobody\"")]
    public async Task A_bad_scenario_file_stops_the_server_from_starting_with_a_clear_message(string json, params string[] messageParts)
    {
        await using var server = new ScoreMapServer { Scenario = "bad" };
        server.WriteScenario("bad", json);

        var error = Record.Exception(() => server.CreateClient());

        Assert.NotNull(error);
        Assert.Contains("Scenario \"bad\"", error.ToString());
        foreach (var part in messageParts)
            Assert.Contains(part, error.ToString());
    }

    [Fact]
    public async Task A_scenario_with_no_file_stops_the_server_from_starting()
    {
        await using var server = new ScoreMapServer { Scenario = "missing" };

        var error = Record.Exception(() => server.CreateClient());

        Assert.NotNull(error);
        Assert.Contains("Scenario \"missing\"", error.ToString());
        Assert.Contains("no such file", error.ToString());
    }

    [Fact]
    public async Task Outside_development_a_scenario_setting_is_ignored_and_nothing_scenario_related_is_registered()
    {
        await using var server = new ScoreMapServer { Scenario = "test", Environment = "Production" };
        server.WriteScenario("test", OneLiveGame);
        server.Feed.SetScoreboard(Nfl, LiveGame(server.Clock, "real-game"));

        await using var client = await server.ConnectClientAsync();
        var snapshot = await client.NextSnapshotAsync();

        Assert.Equal("real-game", Assert.Single(snapshot).Id);
        Assert.Null(server.Services.GetService<ScenarioSwitcher>());
    }

    [Fact]
    public async Task Outside_development_live_leagues_are_still_polled_every_15_seconds()
    {
        await using var server = new ScoreMapServer { Scenario = "test", Environment = "Production" };
        server.WriteScenario("test", OneLiveGame);
        server.Feed.SetScoreboard(Nfl, LiveGame(server.Clock, "real-game"));
        await using var client = await server.ConnectClientAsync();
        await client.NextSnapshotAsync();

        server.Clock.Advance(TimeSpan.FromSeconds(14));
        await Task.Delay(100);
        Assert.Equal(1, server.Feed.Fetches(Nfl));
        server.Clock.Advance(TimeSpan.FromSeconds(1));
        await server.Feed.WaitForFetchesAsync(Nfl, 2);
    }
}
