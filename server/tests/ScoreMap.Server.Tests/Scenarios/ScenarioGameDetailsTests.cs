using System.Net;
using System.Net.Http.Json;
using ScoreMap.Server.Games;
using ScoreMap.Server.Scenarios;
using ScoreMap.Server.Tests.Support;
using static ScoreMap.Server.Tests.Support.TestGames;

namespace ScoreMap.Server.Tests.Scenarios;

/// <summary>
/// The event panel's tabs for a scenario's games: made up from each game, as the selected game's
/// details are for real games from ESPN's summary.
/// </summary>
public class ScenarioGameDetailsTests
{
    private const string Venue = """{ "name": "Test Ground", "city": "Somewhere", "notInVenueList": true }""";

    private static string OneGame(string league, string home, string away, string state) => $$"""
        {
          "games": [
            {
              "id": "the-game",
              "league": "{{league}}",
              "home": {{home}},
              "away": {{away}},
              "venue": {{Venue}},
              {{state}}
            }
          ]
        }
        """;

    private static async Task<GameDetails> DetailsAsync(string scenario, string league)
    {
        await using var server = new ScoreMapServer { Scenario = "details" };
        server.WriteScenario("details", scenario);
        return await DetailsAsync(server, "the-game", league);
    }

    /// <summary>The details of the shipped edge-cases scenario's game <paramref name="id"/>.</summary>
    private static async Task<GameDetails> EdgeCaseDetailsAsync(string id, string league)
    {
        await using var server = new ScoreMapServer { UseShippedScenarios = true };
        using var http = server.CreateClient();
        (await http.PutAsJsonAsync("/api/scenarios/running", new { name = "edge-cases" }, TestContext.Current.CancellationToken))
            .EnsureSuccessStatusCode();
        return await DetailsAsync(server, id, league);
    }

    private static async Task<GameDetails> DetailsAsync(ScoreMapServer server, string id, string league)
    {
        await using var viewer = await server.ConnectClientAsync();
        Assert.Contains(await viewer.NextSnapshotAsync(), game => game.Id == id);
        using var http = server.CreateClient();
        var details = await http.GetFromJsonAsync<GameDetails>(
            $"/api/game-details?id={id}&league={Uri.EscapeDataString(league)}", TestContext.Current.CancellationToken);
        Assert.NotNull(details);
        return details;
    }

    private static void HasNoSidesTabs(GameDetails details)
    {
        Assert.Empty(details.PeriodScores);
        Assert.Empty(details.Scoring);
        Assert.Empty(details.Drives);
    }

    private static void HasVideosAndBroadcasts(GameDetails details)
    {
        Assert.NotEmpty(details.Videos);
        Assert.All(details.Videos, video => Assert.StartsWith("https://www.espn.com/#", video.Url));
        Assert.Equal(details.Videos.Count, details.Videos.Select(video => video.Url).Distinct().Count());
        Assert.NotEmpty(details.Broadcasts);
    }

    [Fact]
    public async Task A_football_game_under_way_has_its_quarters_so_far_scoring_drives_stats_videos_and_networks()
    {
        var details = await DetailsAsync(OneGame("NFL",
            """{ "name": "Kansas City Chiefs", "abbreviation": "KC", "score": 21 }""",
            """{ "name": "Buffalo Bills", "abbreviation": "BUF", "score": 10 }""",
            """ "startsIn": "-1h40m", "status": "live", "clock": "8:12", "period": 3 """), "NFL");

        Assert.Equal(["Q1", "Q2", "Q3", "Q4"], details.PeriodScores.Select(period => period.Label));
        Assert.All(details.PeriodScores.Take(3), period => Assert.NotNull(period.Home));
        Assert.Equal((null, null), (details.PeriodScores[3].Home, details.PeriodScores[3].Away));
        Assert.Equal(("21", "10"), (details.HomeTotal, details.AwayTotal));
        Assert.NotEmpty(details.Scoring);
        Assert.All(details.Scoring, play => Assert.Contains(play.Team, new[] { "KC", "BUF" }));
        Assert.NotEmpty(details.Drives);
        Assert.All(details.Drives, drive => Assert.Contains(drive.Team, new[] { "KC", "BUF" }));
        Assert.Equal(["BUF", "KC"], details.Stats.Select(team => team.Team).Order());
        Assert.All(details.Stats, team => Assert.Contains(team.Sections, section => section.Name == "Passing"));
        HasVideosAndBroadcasts(details);
    }

    [Fact]
    public async Task A_basketball_game_has_its_line_score_scoring_and_box_score_but_no_drives()
    {
        var details = await DetailsAsync(OneGame("NBA",
            """{ "name": "Golden State Warriors", "abbreviation": "GS", "score": 58 }""",
            """{ "name": "Los Angeles Lakers", "abbreviation": "LAL", "score": 61 }""",
            """ "startsIn": "-1h", "status": "live", "clock": "1:12", "period": 2 """), "NBA");

        Assert.Equal(["Q1", "Q2", "Q3", "Q4"], details.PeriodScores.Select(period => period.Label));
        Assert.NotEmpty(details.Scoring);
        Assert.Empty(details.Drives);
        Assert.All(details.Stats, team => Assert.Equal(["Starters", "Bench"], team.Sections.Select(section => section.Name)));
        HasVideosAndBroadcasts(details);
    }

    [Fact]
    public async Task A_soccer_match_has_a_play_for_each_goal_and_players_stats_but_no_line_score_or_drives()
    {
        var details = await DetailsAsync(OneGame("Premier League",
            """{ "name": "Arsenal", "abbreviation": "ARS", "score": 2 }""",
            """{ "name": "Chelsea", "abbreviation": "CHE", "score": 1 }""",
            """ "startsIn": "-1h20m", "status": "live", "clock": "67'", "period": 2 """), "Premier League");

        Assert.Empty(details.PeriodScores);
        Assert.Equal(["ARS", "ARS", "CHE"], details.Scoring.Select(play => play.Team).Order());
        Assert.Equal((2, 1), (details.Scoring[^1].HomeScore, details.Scoring[^1].AwayScore));
        Assert.Empty(details.Drives);
        Assert.Equal(2, details.Stats.Count);
        HasVideosAndBroadcasts(details);
    }

    [Fact]
    public async Task A_tennis_match_has_each_players_serve_stats_and_no_scoring_tabs()
    {
        var details = await DetailsAsync("""
            {
              "games": [ { "id": "the-game", "league": "ATP",
                           "home": { "name": "Jannik Sinner", "abbreviation": "J. Sinner", "score": 1 },
                           "away": { "name": "Carlos Alcaraz", "abbreviation": "C. Alcaraz", "score": 0 },
                           "venue": { "name": "Centre Court", "city": "Somewhere", "notInVenueList": true },
                           "startsIn": "-1h", "status": "live", "period": 2 } ]
            }
            """, "ATP");

        HasNoSidesTabs(details);
        Assert.Equal(["Carlos Alcaraz", "Jannik Sinner"],
            details.Stats.Select(team => Assert.Single(Assert.Single(team.Sections).Players).Name).Order());
        HasVideosAndBroadcasts(details);
    }

    [Fact]
    public async Task A_golf_tournament_has_its_leaders_rounds_so_far()
    {
        var details = await EdgeCaseDetailsAsync("edge-golf-final-round", "PGA Tour");

        HasNoSidesTabs(details);
        var rounds = Assert.Single(Assert.Single(details.Stats).Sections);
        Assert.Equal(["R1", "R2", "R3", "R4", "TOT"], rounds.Columns);
        Assert.Equal("Scottie Scheffler", rounds.Players[0].Name);
        Assert.Equal(10, rounds.Players.Count);
        HasVideosAndBroadcasts(details);
    }

    [Fact]
    public async Task A_race_has_the_front_of_its_running_order()
    {
        var details = await EdgeCaseDetailsAsync("edge-f1-under-way", "Formula 1");

        HasNoSidesTabs(details);
        var order = Assert.Single(Assert.Single(details.Stats).Sections);
        Assert.Equal(["LAPS", "LED", "PITS"], order.Columns);
        Assert.Equal(["Charles Leclerc", "42"], [order.Players[0].Name, order.Players[0].Values[0]]);
        HasVideosAndBroadcasts(details);
    }

    [Fact]
    public async Task A_fight_card_has_the_stats_of_each_bout_fought_so_far()
    {
        var details = await EdgeCaseDetailsAsync("edge-ufc-under-way", "UFC");

        HasNoSidesTabs(details);
        var bouts = Assert.Single(details.Stats).Sections;
        Assert.Equal(7, bouts.Count);
        Assert.Equal("Jon Jones vs. Stipe Miocic", bouts[^1].Name);
        Assert.All(bouts, bout => Assert.Equal(2, bout.Players.Count));
        HasVideosAndBroadcasts(details);
    }

    [Fact]
    public async Task A_game_has_the_same_details_each_time_and_they_grow_as_it_goes_on()
    {
        await using var server = new ScoreMapServer { Scenario = "details" };
        server.WriteScenario("details", """
            {
              "games": [
                {
                  "id": "the-game",
                  "league": "NFL",
                  "home": { "name": "Kansas City Chiefs", "abbreviation": "KC", "score": 14 },
                  "away": { "name": "Buffalo Bills", "abbreviation": "BUF", "score": 7 },
                  "venue": { "name": "Test Ground", "city": "Somewhere", "notInVenueList": true },
                  "startsIn": "-1h", "status": "live", "clock": "9:30", "period": 2
                }
              ],
              "timeline": {
                "length": "1h",
                "changes": [
                  { "at": "1m", "game": "the-game", "score": { "home": 21 }, "period": 3, "clock": "11:00" },
                  { "at": "2m", "game": "the-game", "score": { "away": 17 }, "status": "final" }
                ]
              }
            }
            """);
        await using var viewer = await server.ConnectClientAsync();
        await viewer.NextSnapshotAsync();
        using var http = server.CreateClient();
        var cancellationToken = TestContext.Current.CancellationToken;
        const string url = "/api/game-details?id=the-game&league=NFL";

        Assert.Equal(await http.GetStringAsync(url, cancellationToken), await http.GetStringAsync(url, cancellationToken));
        var seen = new List<GameDetails>();
        foreach (var _ in new[] { "Q2", "Q3", "Final" })
        {
            seen.Add((await http.GetFromJsonAsync<GameDetails>(url, cancellationToken))!);
            server.Clock.Advance(TimeSpan.FromMinutes(1));
        }

        Assert.Equal([2, 3, 4], seen.Select(details => details.PeriodScores.Count(period => period.Home is not null)));
        Assert.Equal(["14", "21", "21"], seen.Select(details => details.HomeTotal));
        foreach (var (before, after) in seen.Zip(seen.Skip(1)))
        {
            Assert.True(after.Scoring.Count > before.Scoring.Count);
            Assert.True(after.Drives.Count > before.Drives.Count);
            Assert.True(after.Videos.Count >= before.Videos.Count);
        }
        Assert.All(seen[^1].Drives, drive => Assert.NotNull(drive.Outcome));
    }

    [Theory]
    [InlineData("worldwide")]
    [InlineData("edge-cases")]
    [InlineData("crowded")]
    public async Task No_shipped_scenario_game_has_a_number_below_zero_or_drives_outside_football(string scenario)
    {
        await using var server = new ScoreMapServer { UseShippedScenarios = true };
        using var http = server.CreateClient();
        var cancellationToken = TestContext.Current.CancellationToken;
        (await http.PutAsJsonAsync("/api/scenarios/running", new { name = scenario }, cancellationToken)).EnsureSuccessStatusCode();
        await using var viewer = await server.ConnectClientAsync();
        var games = await viewer.NextSnapshotAsync();
        Assert.NotEmpty(games);

        foreach (var game in games)
        {
            var details = (await http.GetFromJsonAsync<GameDetails>(
                $"/api/game-details?id={game.Id}&league={Uri.EscapeDataString(game.League)}", cancellationToken))!;
            var numbers = details.PeriodScores.SelectMany(period => new[] { period.Home, period.Away })
                .Concat(details.Stats.SelectMany(team => team.Sections).SelectMany(section => section.Players)
                    .SelectMany(player => player.Values))
                .OfType<string>();
            Assert.All(numbers, value => Assert.DoesNotMatch(@"(^|[^\d])-\d", value));
            Assert.All(details.Scoring, play => Assert.True(play.HomeScore is null or >= 0 && play.AwayScore is null or >= 0));
            Assert.All(details.Drives, drive => Assert.True(drive is { Plays: > 0, Yards: >= 0 }));
            Assert.All(details.Videos, video => Assert.True(video.Duration > 0));
            if (game.Sport != "Football")
                Assert.Empty(details.Drives);
            Assert.All(details.Stats.SelectMany(team => team.Sections),
                section => Assert.All(section.Players, player => Assert.Equal(section.Columns.Count, player.Values.Count)));
        }
    }

    [Fact]
    public async Task A_demo_game_has_made_up_details_on_the_live_site_and_only_a_demo_asks_for_them()
    {
        await using var server = new ScoreMapServer { Environment = "Production" };
        server.WriteScenario(DemoBoard.Scenario, OneGame("NFL",
            """{ "name": "Kansas City Chiefs", "abbreviation": "KC", "score": 21 }""",
            """{ "name": "Buffalo Bills", "abbreviation": "BUF", "score": 10 }""",
            """ "startsIn": "-1h40m", "status": "live", "clock": "8:12", "period": 3 """));
        server.Feed.SetScoreboard(Nfl, LiveGame(server.Clock, "real-game"));
        await using var demo = await server.ConnectClientAsync(demo: true);
        Assert.Equal("the-game", Assert.Single(await demo.NextSnapshotAsync()).Id);
        await using var real = await server.ConnectClientAsync();
        Assert.Equal("real-game", Assert.Single(await real.NextSnapshotAsync()).Id);
        using var http = server.CreateClient();
        var cancellationToken = TestContext.Current.CancellationToken;

        var details = await http.GetFromJsonAsync<GameDetails>("/api/game-details?id=the-game&league=NFL&demo=true", cancellationToken);

        Assert.NotNull(details);
        Assert.NotEmpty(details.Drives);
        Assert.Equal(HttpStatusCode.NotFound, (await http.GetAsync("/api/game-details?id=the-game&league=NFL", cancellationToken)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await http.GetAsync("/api/game-details?id=real-game&league=NFL&demo=true", cancellationToken)).StatusCode);
    }

    /// <summary>The facts the browser sends for a tour game, with display text supplied to test that it has no effect.</summary>
    private static object TourGame(string id, string league, int period = 2, string phase = "Playing", string? clock = null) => new
    {
        id,
        league,
        status = "Live",
        contest = new
        {
            kind = "sides",
            home = new { abbreviation = "NYG", fullName = "New York Giants", logoUrl = (string?)null, score = "99" },
            away = new { abbreviation = "DAL", fullName = "Dallas Cowboys", logoUrl = (string?)null, score = "77" },
        },
        clock,
        period,
        phase,
        homeScore = 17,
        awayScore = 10,
    };

    [Fact]
    public async Task A_tour_game_sent_by_the_browser_gets_made_up_details_on_the_live_site()
    {
        await using var server = new ScoreMapServer { Environment = "Production" };
        using var http = server.CreateClient();
        var cancellationToken = TestContext.Current.CancellationToken;

        var response = await http.PostAsJsonAsync("/api/tour-game-details", TourGame("tour-nfl-nyg", "NFL"), cancellationToken);

        response.EnsureSuccessStatusCode();
        var details = await response.Content.ReadFromJsonAsync<GameDetails>(cancellationToken);
        Assert.NotNull(details);
        Assert.Equal(2, details.PeriodScores.Count(period => period.Home is not null));
        Assert.Equal(("17", "10"), (details.HomeTotal, details.AwayTotal));
        Assert.NotEmpty(details.Drives);
        Assert.Equal(["DAL", "NYG"], details.Stats.Select(team => team.Team).Order());
        HasVideosAndBroadcasts(details);
        var again = await http.PostAsJsonAsync("/api/tour-game-details", TourGame("tour-nfl-nyg", "NFL"), cancellationToken);
        Assert.Equal(await response.Content.ReadAsStringAsync(cancellationToken), await again.Content.ReadAsStringAsync(cancellationToken));
    }

    [Theory]
    [InlineData("401761625", "NFL")]
    [InlineData("tour-nfl-nyg", "Arena Football")]
    public async Task Only_a_tour_game_in_a_known_league_gets_made_up_details(string id, string league)
    {
        await using var server = new ScoreMapServer { Environment = "Production" };
        using var http = server.CreateClient();

        var response = await http.PostAsJsonAsync("/api/tour-game-details", TourGame(id, league), TestContext.Current.CancellationToken);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Theory]
    [InlineData("InningTop", "Bot 9th", false)]
    [InlineData("InningBottom", "Top 1st", true)]
    public async Task A_tour_games_details_follow_its_period_phase_and_numeric_scores(string phase, string clock, bool homeHasBatted)
    {
        await using var server = new ScoreMapServer { Environment = "Production" };
        using var http = server.CreateClient();
        var cancellationToken = TestContext.Current.CancellationToken;

        var response = await http.PostAsJsonAsync("/api/tour-game-details",
            TourGame("tour-mlb-game", "MLB", period: 6, phase: phase, clock: clock), cancellationToken);

        response.EnsureSuccessStatusCode();
        var details = await response.Content.ReadFromJsonAsync<GameDetails>(cancellationToken);
        Assert.NotNull(details);
        Assert.Equal(6, details.PeriodScores.Count(period => period.Away is not null));
        Assert.Equal(homeHasBatted, details.PeriodScores[5].Home is not null);
        Assert.Equal(("17", "10"), (details.HomeTotal, details.AwayTotal));
        Assert.Equal((17, 10), (details.Scoring[^1].HomeScore, details.Scoring[^1].AwayScore));
    }
}
