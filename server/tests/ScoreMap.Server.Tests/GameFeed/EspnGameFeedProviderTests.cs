using Microsoft.Extensions.Time.Testing;
using ScoreMap.Server.GameFeed;
using ScoreMap.Server.Tests.Support;

namespace ScoreMap.Server.Tests.GameFeed;

/// <summary>Runs saved real ESPN scoreboard responses through the adapter.</summary>
public class EspnGameFeedProviderTests
{
    private const string Nfl = "football/nfl";

    private static async Task<IReadOnlyList<ProviderGame>> FetchFixtureAsync(string fixture, string leagueKey)
    {
        var body = await File.ReadAllTextAsync(Path.Combine(AppContext.BaseDirectory, "Fixtures", "Espn", fixture));
        var provider = new EspnGameFeedProvider(
            new HttpClient(StubHttpHandler.Returning(body)) { BaseAddress = new Uri("https://espn.test/sports/") },
            new FakeTimeProvider(new DateTimeOffset(2026, 10, 4, 18, 0, 0, TimeSpan.Zero)));
        return await provider.FetchScoreboardAsync(leagueKey, CancellationToken.None);
    }

    [Fact]
    public async Task Final_game_abroad_carries_its_real_venue_teams_scores_and_broadcasters()
    {
        var games = await FetchFixtureAsync("nfl.json", Nfl);

        var london = Assert.Single(games, g => g.Id == "401872965");
        Assert.Equal(Nfl, london.LeagueKey);
        Assert.Equal(new DateTimeOffset(2026, 10, 4, 13, 30, 0, TimeSpan.Zero), london.StartTime);
        Assert.Equal(new ProviderTeam("WSH", "Washington Commanders",
            "https://a.espncdn.com/i/teamlogos/nfl/500/scoreboard/wsh.png", 13), london.Home);
        Assert.Equal(new ProviderTeam("IND", "Indianapolis Colts",
            "https://a.espncdn.com/i/teamlogos/nfl/500/scoreboard/ind.png", 30), london.Away);
        Assert.Equal(ProviderStatus.Final, london.Status);
        Assert.Equal("0:00", london.DisplayClock);
        Assert.Equal(4, london.Period);
        Assert.Equal(new ProviderVenue("Tottenham Hotspur Stadium", "London", null, "England", "5534"), london.Venue);
        Assert.Equal([new ProviderBroadcaster("NFL Net", "US")], london.Broadcasters);
    }

    [Fact]
    public async Task Game_in_progress_carries_score_clock_and_period()
    {
        var games = await FetchFixtureAsync("nfl.json", Nfl);

        var game = Assert.Single(games, g => g.Id == "401872978");
        Assert.Equal(ProviderStatus.InProgress, game.Status);
        Assert.Equal(22, game.Home.Score);
        Assert.Equal(19, game.Away.Score);
        Assert.Equal("4:28", game.DisplayClock);
        Assert.Equal(3, game.Period);
        Assert.Equal(new ProviderVenue("Bank of America Stadium", "Charlotte", "NC", "USA", "3628"), game.Venue);
    }

    [Fact]
    public async Task Scheduled_game_has_no_score_clock_or_period_yet()
    {
        var games = await FetchFixtureAsync("nfl.json", Nfl);

        var game = Assert.Single(games, g => g.Id == "401872979");
        Assert.Equal(ProviderStatus.Scheduled, game.Status);
        Assert.Equal(new DateTimeOffset(2026, 10, 6, 0, 15, 0, TimeSpan.Zero), game.StartTime);
        Assert.Null(game.Home.Score);
        Assert.Null(game.Away.Score);
        Assert.Null(game.DisplayClock);
        Assert.Null(game.Period);
    }

    [Fact]
    public async Task Every_game_on_the_scoreboard_is_reported()
    {
        var games = await FetchFixtureAsync("nfl.json", Nfl);

        Assert.Equal(["401872978", "401872965", "401872971", "401872979"], games.Select(g => g.Id));
    }

    [Fact]
    public async Task Baseball_game_in_progress_carries_its_inning_and_which_half_is_being_played()
    {
        var games = await FetchFixtureAsync("mlb.json", "baseball/mlb");

        var game = Assert.Single(games, g => g.Id == "401908014");
        Assert.Equal(ProviderStatus.InProgress, game.Status);
        Assert.Equal(7, game.Period);
        Assert.Equal(ProviderPeriodPhase.InningTop, game.Phase);
        Assert.Equal(1, game.Home.Score);
        Assert.Equal(2, game.Away.Score);
        Assert.Equal(new ProviderVenue("Dodger Stadium", "Los Angeles", "California", null, "19"), game.Venue);
    }

    [Fact]
    public async Task Cricket_chase_in_progress_carries_runs_wickets_overs_and_target()
    {
        var games = await FetchFixtureAsync("cricket-live.json", "cricket/8656");

        var game = Assert.Single(games, g => g.Id == "1551869");
        Assert.Equal((ProviderStatus.InProgress, 2), (game.Status, game.Period));
        // "100/6 (13/20 ov, target 187)" chasing "186/6".
        Assert.Equal((100, new ProviderInnings(6, "13", 20, 187)), (game.Home.Score, game.Home.Innings));
        Assert.Equal((186, new ProviderInnings(6)), (game.Away.Score, game.Away.Innings));
        Assert.Equal(new ProviderVenue("Mangaung Oval, Bloemfontein", "Bloemfontein", "", "South Africa", "59042"), game.Venue);
    }

    [Fact]
    public async Task Cricket_side_all_out_has_its_runs_without_wickets()
    {
        var games = await FetchFixtureAsync("cricket-ipl-2026.json", "cricket/8048");

        var game = Assert.Single(games, g => g.Id == "1527676");
        Assert.Equal(ProviderStatus.Final, game.Status);
        // "127" all out, chased down with "128/2 (12.1/20 ov, target 128)".
        Assert.Equal((127, new ProviderInnings(null)), (game.Away.Score, game.Away.Innings));
        Assert.Equal((128, new ProviderInnings(2, "12.1", 20, 128)), (game.Home.Score, game.Home.Innings));
    }

    [Fact]
    public async Task Cricket_side_that_never_batted_has_no_score()
    {
        var games = await FetchFixtureAsync("cricket-ipl-2026.json", "cricket/8048");

        // No result: the home side batted first, and rain stopped play before the away side batted.
        var game = Assert.Single(games, g => g.Id == "1527685");
        Assert.Equal((25, new ProviderInnings(2, "3.4", 20)), (game.Home.Score, game.Home.Innings));
        Assert.Equal((null, null), (game.Away.Score, game.Away.Innings));
    }

    [Fact]
    public async Task College_football_final_is_reported()
    {
        var games = await FetchFixtureAsync("college-football.json", "football/college-football");

        var game = Assert.Single(games);
        Assert.Equal(ProviderStatus.Final, game.Status);
        Assert.Equal(("UGA", 38), (game.Home.Abbreviation, game.Home.Score));
        Assert.Equal(("VAN", 14), (game.Away.Abbreviation, game.Away.Score));
        Assert.Equal(4, game.Period);
    }

    [Fact]
    public async Task Basketball_final_carries_quarter_and_score()
    {
        var games = await FetchFixtureAsync("nba.json", "basketball/nba");

        var game = Assert.Single(games);
        Assert.Equal(ProviderStatus.Final, game.Status);
        Assert.Equal(("DEN", 97), (game.Home.Abbreviation, game.Home.Score));
        Assert.Equal(("UTAH", 109), (game.Away.Abbreviation, game.Away.Score));
        Assert.Equal(4, game.Period);
    }

    [Fact]
    public async Task College_basketball_game_abroad_is_scheduled_at_its_real_venue()
    {
        var games = await FetchFixtureAsync("mens-college-basketball.json", "basketball/mens-college-basketball?groups=50");

        var game = Assert.Single(games);
        Assert.Equal("basketball/mens-college-basketball?groups=50", game.LeagueKey);
        Assert.Equal(ProviderStatus.Scheduled, game.Status);
        Assert.Equal(new ProviderVenue("Palazzo dello Sport", "Rome", "Italy", null, "3282"), game.Venue);
    }

    [Fact]
    public async Task Hockey_game_in_progress_carries_score_clock_and_period()
    {
        var games = await FetchFixtureAsync("nhl.json", "hockey/nhl");

        var game = Assert.Single(games, g => g.Id == "401891778");
        Assert.Equal(ProviderStatus.InProgress, game.Status);
        Assert.Equal(("ANA", 2), (game.Home.Abbreviation, game.Home.Score));
        Assert.Equal(("FLA", 1), (game.Away.Abbreviation, game.Away.Score));
        Assert.Equal("6:35", game.DisplayClock);
        Assert.Equal(3, game.Period);
        Assert.Equal(ProviderPeriodPhase.Playing, game.Phase);
    }

    [Fact]
    public async Task Soccer_full_time_is_final_after_two_halves()
    {
        var games = await FetchFixtureAsync("soccer-eng1-fulltime.json", "soccer/eng.1");

        var game = Assert.Single(games);
        Assert.Equal(ProviderStatus.Final, game.Status);
        Assert.Equal(("NFO", 1), (game.Home.Abbreviation, game.Home.Score));
        Assert.Equal(("MNC", 0), (game.Away.Abbreviation, game.Away.Score));
        Assert.Equal(2, game.Period);
        Assert.Equal(new ProviderVenue("The City Ground", "Nottingham", null, "England", "131"), game.Venue);
    }

    [Fact]
    public async Task Soccer_final_after_extra_time_reaches_the_fourth_period()
    {
        var games = await FetchFixtureAsync("soccer-worldcup-final-aet.json", "soccer/fifa.world");

        var game = Assert.Single(games);
        Assert.Equal(ProviderStatus.Final, game.Status);
        Assert.Equal(("ESP", 1), (game.Home.Abbreviation, game.Home.Score));
        Assert.Equal(("ARG", 0), (game.Away.Abbreviation, game.Away.Score));
        Assert.Equal(4, game.Period);
    }

    [Fact]
    public async Task Scheduled_soccer_game_has_no_score_clock_or_period_yet()
    {
        var games = await FetchFixtureAsync("soccer-mls-scheduled.json", "soccer/usa.1");

        var game = Assert.Single(games);
        Assert.Equal(ProviderStatus.Scheduled, game.Status);
        Assert.Null(game.Home.Score);
        Assert.Null(game.DisplayClock);
        Assert.Null(game.Period);
        Assert.Equal(new ProviderVenue("Soldier Field", "Chicago, Illinois", null, "USA", "1452"), game.Venue);
    }

    [Theory]
    [InlineData("STATUS_HALFTIME", "Halftime", ProviderPeriodPhase.Break)]
    [InlineData("STATUS_END_PERIOD", "End of 2nd", ProviderPeriodPhase.Break)]
    [InlineData("STATUS_END_OF_EXTRATIME", "End ET", ProviderPeriodPhase.Break)]
    [InlineData("STATUS_SHOOTOUT", "Shootout", ProviderPeriodPhase.Shootout)]
    [InlineData("STATUS_IN_PROGRESS", "4:28 - 3rd", ProviderPeriodPhase.Playing)]
    public async Task Breaks_and_shootouts_are_reported_as_the_phase_of_the_period(
        string statusName, string shortDetail, ProviderPeriodPhase phase)
    {
        var body = $$$"""
            {"events":[{"id":"1","date":"2026-10-04T17:00Z",
              "status":{"displayClock":"0:00","period":2,
                "type":{"name":"{{{statusName}}}","state":"in","completed":false,"shortDetail":"{{{shortDetail}}}"}},
              "competitions":[{"competitors":[
                {"homeAway":"home","team":{"abbreviation":"H","displayName":"Home"},"score":"1"},
                {"homeAway":"away","team":{"abbreviation":"A","displayName":"Away"},"score":"0"}]}]}]}
            """;
        var provider = new EspnGameFeedProvider(
            new HttpClient(StubHttpHandler.Returning(body)) { BaseAddress = new Uri("https://espn.test/sports/") },
            new FakeTimeProvider(new DateTimeOffset(2026, 10, 4, 18, 0, 0, TimeSpan.Zero)));

        var game = Assert.Single(await provider.FetchScoreboardAsync("hockey/nhl", CancellationToken.None));

        Assert.Equal(ProviderStatus.InProgress, game.Status);
        Assert.Equal(phase, game.Phase);
    }

    private static async Task<IReadOnlyList<string>> RequestedUrlsAtAsync(DateTimeOffset now)
    {
        var handler = StubHttpHandler.Returning("""{"events":[]}""");
        var provider = new EspnGameFeedProvider(
            new HttpClient(handler) { BaseAddress = new Uri("https://espn.test/sports/") },
            new FakeTimeProvider(now));

        await provider.FetchScoreboardAsync(Nfl, CancellationToken.None);

        return handler.Requests.Select(r => r.RequestUri!.ToString()).Order().ToList();
    }

    [Fact]
    public async Task Asks_for_the_league_scoreboards_of_yesterday_and_today_in_US_Eastern_days()
    {
        // 18:00 UTC on 4 Oct is 14:00 in New York; yesterday's games may still be Live, Final or Disrupted.
        var urls = await RequestedUrlsAtAsync(new DateTimeOffset(2026, 10, 4, 18, 0, 0, TimeSpan.Zero));

        Assert.Equal([
            "https://espn.test/sports/football/nfl/scoreboard?dates=20261003&limit=500",
            "https://espn.test/sports/football/nfl/scoreboard?dates=20261004&limit=500",
        ], urls);
    }

    [Fact]
    public async Task Within_three_hours_of_US_Eastern_midnight_also_asks_for_tomorrows_scoreboard()
    {
        // 02:00 UTC on 5 Oct is still 22:00 on 4 Oct in New York, so games just after midnight are Upcoming.
        var urls = await RequestedUrlsAtAsync(new DateTimeOffset(2026, 10, 5, 2, 0, 0, TimeSpan.Zero));

        Assert.Equal([
            "https://espn.test/sports/football/nfl/scoreboard?dates=20261003&limit=500",
            "https://espn.test/sports/football/nfl/scoreboard?dates=20261004&limit=500",
            "https://espn.test/sports/football/nfl/scoreboard?dates=20261005&limit=500",
        ], urls);
    }

    [Fact]
    public async Task A_game_listed_on_more_than_one_day_is_reported_once()
    {
        var body = await File.ReadAllTextAsync(Path.Combine(AppContext.BaseDirectory, "Fixtures", "Espn", "nfl.json"));
        var provider = new EspnGameFeedProvider(
            new HttpClient(StubHttpHandler.Returning(body)) { BaseAddress = new Uri("https://espn.test/sports/") },
            new FakeTimeProvider(new DateTimeOffset(2026, 10, 5, 2, 0, 0, TimeSpan.Zero)));

        var games = await provider.FetchScoreboardAsync(Nfl, CancellationToken.None);

        Assert.Equal(["401872978", "401872965", "401872971", "401872979"], games.Select(g => g.Id));
    }

    [Fact]
    public async Task Each_days_scoreboard_contributes_its_games()
    {
        static string OneGame(string id) => """
            {"events":[{"id":"ID","date":"2026-10-04T17:00Z","competitions":[{"venue":{"fullName":"V"},
              "competitors":[{"homeAway":"home","team":{"abbreviation":"H"}},{"homeAway":"away","team":{"abbreviation":"A"}}],
              "status":{"type":{"name":"STATUS_FINAL","state":"post"}}}]}]}
            """.Replace("\"ID\"", $"\"{id}\"");
        var handler = new StubHttpHandler(r => OneGame(r.RequestUri!.Query.Contains("20261003") ? "yesterday" : "today"));
        var provider = new EspnGameFeedProvider(
            new HttpClient(handler) { BaseAddress = new Uri("https://espn.test/sports/") },
            new FakeTimeProvider(new DateTimeOffset(2026, 10, 4, 18, 0, 0, TimeSpan.Zero)));

        var games = await provider.FetchScoreboardAsync(Nfl, CancellationToken.None);

        Assert.Equal(["today", "yesterday"], games.Select(g => g.Id).Order());
    }

    [Fact]
    public async Task League_key_can_carry_extra_scoreboard_options()
    {
        // College basketball only lists every Division I game when asked for group 50.
        var handler = StubHttpHandler.Returning("""{"events":[]}""");
        var provider = new EspnGameFeedProvider(
            new HttpClient(handler) { BaseAddress = new Uri("https://espn.test/sports/") },
            new FakeTimeProvider(new DateTimeOffset(2026, 10, 4, 18, 0, 0, TimeSpan.Zero)));

        await provider.FetchScoreboardAsync("basketball/mens-college-basketball?groups=50", CancellationToken.None);

        Assert.Contains(handler.Requests, r => r.RequestUri!.ToString()
            == "https://espn.test/sports/basketball/mens-college-basketball/scoreboard?groups=50&dates=20261004&limit=500");
    }

    private const string NoVenueScoreboard = """
        {"events":[{"id":"1","date":"2026-10-04T17:00Z","competitions":[{
          "competitors":[
            {"homeAway":"home","team":{"id":"29","abbreviation":"CAR","displayName":"Carolina Panthers"}},
            {"homeAway":"away","team":{"id":"22","abbreviation":"ARI","displayName":"Arizona Cardinals"}}],
          "status":{"type":{"name":"STATUS_SCHEDULED","state":"pre"}}}]}]}
        """;

    private static (EspnGameFeedProvider Provider, StubHttpHandler Handler) ProviderAnswering(string scoreboard, string team)
    {
        var handler = new StubHttpHandler(request =>
            request.RequestUri!.AbsolutePath.Contains("/scoreboard") ? scoreboard : team);
        var provider = new EspnGameFeedProvider(
            new HttpClient(handler) { BaseAddress = new Uri("https://espn.test/sports/") },
            new FakeTimeProvider(new DateTimeOffset(2026, 10, 4, 18, 0, 0, TimeSpan.Zero)));
        return (provider, handler);
    }

    [Fact]
    public async Task Game_with_no_venue_carries_the_home_teams_city_from_its_franchise_venue()
    {
        var (provider, handler) = ProviderAnswering(NoVenueScoreboard, """
            {"team":{"id":"29","location":"Carolina","franchise":{"venue":{"fullName":"Bank of America Stadium",
              "address":{"city":"Charlotte","state":"NC","zipCode":"28202","country":"USA"}}}}}
            """);

        var game = Assert.Single(await provider.FetchScoreboardAsync(Nfl, CancellationToken.None));

        Assert.Null(game.Venue);
        Assert.Equal(new ProviderCity("Charlotte", "NC", "USA"), game.Home.HomeCity);
        Assert.Contains(handler.Requests, r => r.RequestUri!.ToString() == "https://espn.test/sports/football/nfl/teams/29");
    }

    [Fact]
    public async Task Home_team_without_a_franchise_venue_falls_back_to_its_location_name()
    {
        // College and soccer teams have no franchise venue; "location" is the best ESPN offers.
        var (provider, _) = ProviderAnswering(NoVenueScoreboard, """{"team":{"id":"150","location":"Duke"}}""");

        var game = Assert.Single(await provider.FetchScoreboardAsync(Nfl, CancellationToken.None));

        Assert.Equal(new ProviderCity("Duke", null, null), game.Home.HomeCity);
    }

    [Fact]
    public async Task Each_home_team_is_looked_up_only_once()
    {
        var (provider, handler) = ProviderAnswering(NoVenueScoreboard, """{"team":{"id":"29","location":"Carolina"}}""");

        await provider.FetchScoreboardAsync(Nfl, CancellationToken.None);
        await provider.FetchScoreboardAsync(Nfl, CancellationToken.None);

        Assert.Single(handler.Requests, r => r.RequestUri!.AbsolutePath.Contains("/teams/"));
    }

    [Fact]
    public async Task Home_teams_are_not_looked_up_for_games_with_a_venue()
    {
        var body = await File.ReadAllTextAsync(Path.Combine(AppContext.BaseDirectory, "Fixtures", "Espn", "nfl.json"));
        var (provider, handler) = ProviderAnswering(body, "{}");

        var games = await provider.FetchScoreboardAsync(Nfl, CancellationToken.None);

        Assert.DoesNotContain(handler.Requests, r => r.RequestUri!.AbsolutePath.Contains("/teams/"));
        Assert.All(games, g => Assert.Null(g.Home.HomeCity));
    }

    [Fact]
    public async Task A_failed_team_lookup_still_reports_the_game()
    {
        var handler = new StubHttpHandler(request => request.RequestUri!.AbsolutePath.Contains("/scoreboard")
            ? NoVenueScoreboard
            : throw new HttpRequestException("ESPN is down"));
        var provider = new EspnGameFeedProvider(
            new HttpClient(handler) { BaseAddress = new Uri("https://espn.test/sports/") },
            new FakeTimeProvider(new DateTimeOffset(2026, 10, 4, 18, 0, 0, TimeSpan.Zero)));

        var game = Assert.Single(await provider.FetchScoreboardAsync(Nfl, CancellationToken.None));

        Assert.Null(game.Home.HomeCity);
    }

    private static string Fixture(string name) =>
        File.ReadAllText(Path.Combine(AppContext.BaseDirectory, "Fixtures", "Espn", name));

    private static EspnGameFeedProvider ProviderOver(StubHttpHandler handler) => new(
        new HttpClient(handler) { BaseAddress = new Uri("https://espn.test/sports/") },
        new FakeTimeProvider(new DateTimeOffset(2026, 10, 4, 18, 0, 0, TimeSpan.Zero)));

    [Fact]
    public async Task Teams_carry_their_poll_ranking_and_record_and_the_game_its_attendance()
    {
        var games = await FetchFixtureAsync("college-football-ranked.json", "football/college-football");

        var game = Assert.Single(games, g => g.Id == "401752865");
        Assert.Equal(("ILL", 17, "5-2"), (game.Home.Abbreviation, game.Home.Rank, game.Home.Record));
        Assert.Equal(("OSU", 1, "6-0"), (game.Away.Abbreviation, game.Away.Rank, game.Away.Record));
        Assert.Equal(60670, game.Attendance);
    }

    [Fact]
    public async Task Unranked_teams_have_no_rank_and_an_attendance_of_nought_is_none()
    {
        // ESPN ranks every team outside its poll 99.
        var games = await FetchFixtureAsync("college-football-ranked.json", "football/college-football");

        var game = Assert.Single(games, g => g.Id == "401761625");
        Assert.Equal((null, null), (game.Home.Rank, game.Away.Rank));
        Assert.Null(game.Attendance);
    }

    [Fact]
    public async Task Soccer_record_is_wins_draws_and_losses()
    {
        var games = await FetchFixtureAsync("soccer-eng1-goals-and-cards.json", "soccer/eng.1");

        var game = Assert.Single(games, g => g.Id == "740656");
        Assert.Equal(("ARS", "5-1-1"), (game.Home.Abbreviation, game.Home.Record));
        Assert.Equal(("WHU", "1-1-5"), (game.Away.Abbreviation, game.Away.Record));
    }

    [Fact]
    public async Task Game_carries_its_note()
    {
        var games = await FetchFixtureAsync("mlb.json", "baseball/mlb");

        Assert.Equal("NLDS - Game 2", Assert.Single(games, g => g.Id == "401908014").Note);
    }

    [Fact]
    public async Task Game_without_notes_has_no_note()
    {
        var games = await FetchFixtureAsync("soccer-eng1-goals-and-cards.json", "soccer/eng.1");

        Assert.All(games, g => Assert.Null(g.Note));
    }

    [Fact]
    public async Task Live_basketball_game_carries_its_last_play()
    {
        var game = Assert.Single(await FetchFixtureAsync("nba-live.json", "basketball/nba"));

        Assert.Equal(new ProviderSituation("Mitchell Robinson defensive rebound"), game.Situation);
    }

    [Fact]
    public async Task Live_hockey_game_carries_its_last_play()
    {
        var game = Assert.Single(await FetchFixtureAsync("nhl-live.json", "hockey/nhl"));

        Assert.Equal(new ProviderSituation("Start of 1st Period"), game.Situation);
    }

    [Fact]
    public async Task Live_baseball_game_carries_its_count_outs_and_last_play()
    {
        var game = Assert.Single(await FetchFixtureAsync("mlb-live.json", "baseball/mlb"));

        Assert.Equal(new ProviderSituation("Blake Snell pitches to Jackson Chourio", Balls: 0, Strikes: 0, Outs: 0), game.Situation);
    }

    [Fact]
    public async Task Live_baseball_game_says_which_bases_have_runners_on()
    {
        // The live game had nobody on base, so a runner is put on second.
        var body = Fixture("mlb-live.json").Replace("\"onSecond\": false", "\"onSecond\": true");
        var provider = ProviderOver(StubHttpHandler.Returning(body));

        var game = Assert.Single(await provider.FetchScoreboardAsync("baseball/mlb", CancellationToken.None));

        Assert.Equal((false, true, false), (game.Situation?.OnFirst, game.Situation?.OnSecond, game.Situation?.OnThird));
    }

    [Fact]
    public async Task Scheduled_game_carries_its_betting_line()
    {
        var game = Assert.Single(await FetchFixtureAsync("nfl-scheduled-odds.json", Nfl));

        Assert.Equal(ProviderStatus.Scheduled, game.Status);
        Assert.Equal(new ProviderOdds("SEA -2.5", 40.5, "DraftKings"), game.Odds);
    }

    [Fact]
    public async Task Soccer_game_carries_its_goals_and_cards_in_order_and_its_last_goal()
    {
        var games = await FetchFixtureAsync("soccer-eng1-goals-and-cards.json", "soccer/eng.1");

        var game = Assert.Single(games, g => g.Id == "740656");
        Assert.Equal([
            new ProviderKeyEvent(KeyEventKind.Goal, "ARS", "Declan Rice", "38'"),
            new ProviderKeyEvent(KeyEventKind.YellowCard, "WHU", "Crysencio Summerville", "58'"),
            new ProviderKeyEvent(KeyEventKind.PenaltyGoal, "ARS", "Bukayo Saka", "67'"),
            new ProviderKeyEvent(KeyEventKind.YellowCard, "WHU", "Lucas Paquetá", "69'"),
        ], game.KeyEvents);
        Assert.Equal(new ProviderScoringPlay("ARS", "Penalty: Bukayo Saka", null, "67'"), game.LastScore);
    }

    [Fact]
    public async Task Soccer_card_without_a_named_player_is_still_listed()
    {
        var games = await FetchFixtureAsync("soccer-eng1-goals-and-cards.json", "soccer/eng.1");

        var game = Assert.Single(games, g => g.Id == "740660");
        Assert.Equal(new ProviderKeyEvent(KeyEventKind.RedCard, "CHE", null, "90'+7'"), game.KeyEvents[^1]);
        Assert.Equal(new ProviderScoringPlay("CHE", "Goal: Estêvão", null, "90'+5'"), game.LastScore);
    }

    [Fact]
    public async Task Soccer_and_cricket_never_ask_for_a_summary()
    {
        var handler = new StubHttpHandler(request => request.RequestUri!.AbsolutePath.Contains("/scoreboard")
            ? Fixture(request.RequestUri.AbsolutePath.Contains("soccer") ? "soccer-eng1-goals-and-cards.json" : "cricket-live.json")
            : throw new InvalidOperationException("Asked for a summary"));
        var provider = ProviderOver(handler);

        await provider.FetchScoreboardAsync("soccer/eng.1", CancellationToken.None);
        var cricket = await provider.FetchScoreboardAsync("cricket/8656", CancellationToken.None);

        Assert.DoesNotContain(handler.Requests, r => r.RequestUri!.AbsolutePath.Contains("/summary"));
        Assert.All(cricket, game => Assert.Null(game.LastScore));
    }

    [Fact]
    public async Task Football_last_score_is_the_summarys_last_scoring_play()
    {
        var provider = ProviderOver(StubHttpHandler.Serving(
            ("https://espn.test/sports/football/college-football/scoreboard", Fixture("college-football-ranked.json")),
            ("https://espn.test/sports/football/college-football/summary?event=401752865", Fixture("college-football-summary.json"))));

        var games = await provider.FetchScoreboardAsync("football/college-football", CancellationToken.None);

        var game = Assert.Single(games, g => g.Id == "401752865");
        Assert.Equal(new ProviderScoringPlay("ILL",
            "Collin Dixon 4 Yd pass from Luke Altmyer (Two-Point Pass Conversion Failed)", 4, "4:25"), game.LastScore);
    }

    /// <summary>A basketball game, ATL at DET, under way at <paramref name="home"/>–<paramref name="away"/>, as ESPN's scoreboard has it.</summary>
    private static string BasketballScoreboard(int home, int away) => $$$$"""
        {"events":[{"id":"401810164","date":"2026-10-04T17:00Z","competitions":[{"venue":{"fullName":"Little Caesars Arena"},
          "competitors":[
            {"id":"8","homeAway":"home","team":{"id":"8","abbreviation":"DET","displayName":"Detroit Pistons"},"score":"{{{{home}}}}"},
            {"id":"1","homeAway":"away","team":{"id":"1","abbreviation":"ATL","displayName":"Atlanta Hawks"},"score":"{{{{away}}}}"}],
          "status":{"displayClock":"1.8","period":4,"type":{"name":"STATUS_IN_PROGRESS","state":"in"}}}]}]}
        """;

    private static StubHttpHandler BasketballServing(Func<string> scoreboard, Func<string> summary) =>
        new(request => request.RequestUri!.AbsolutePath.Contains("/scoreboard") ? scoreboard() : summary());

    [Fact]
    public async Task Basketball_last_score_is_the_last_scoring_play_among_every_play()
    {
        var provider = ProviderOver(BasketballServing(() => BasketballScoreboard(99, 98), () => Fixture("nba-summary.json")));

        var game = Assert.Single(await provider.FetchScoreboardAsync("basketball/nba", CancellationToken.None));

        // The summary goes on past it, with a rebound and the end of the game.
        Assert.Equal(new ProviderScoringPlay("ATL",
            "Nickeil Alexander-Walker makes 22-foot three point jumper (Jalen Johnson assists)", 4, "1.8"), game.LastScore);
    }

    [Fact]
    public async Task Baseball_last_score_says_which_half_of_the_inning()
    {
        var scoreboard = """
            {"events":[{"id":"401907972","date":"2026-10-04T17:00Z","competitions":[{"venue":{"fullName":"Truist Park"},
              "competitors":[
                {"id":"15","homeAway":"home","team":{"id":"15","abbreviation":"ATL","displayName":"Atlanta Braves"},"score":"3"},
                {"id":"22","homeAway":"away","team":{"id":"22","abbreviation":"PHI","displayName":"Philadelphia Phillies"},"score":"4"}],
              "status":{"period":10,"type":{"name":"STATUS_FINAL","state":"post"}}}]}]}
            """;
        var provider = ProviderOver(BasketballServing(() => scoreboard, () => Fixture("mlb-summary.json")));

        var game = Assert.Single(await provider.FetchScoreboardAsync("baseball/mlb", CancellationToken.None));

        Assert.Equal(("PHI", "Bohm homered to right (357 feet).", 10, ProviderPeriodPhase.InningTop),
            (game.LastScore!.Team, game.LastScore.Text, game.LastScore.Period, game.LastScore.Phase));
    }

    [Fact]
    public async Task Summary_is_asked_for_again_only_once_the_score_changes()
    {
        var (home, away) = (99, 98);
        var handler = BasketballServing(() => BasketballScoreboard(home, away), () => Fixture("nba-summary.json"));
        var provider = ProviderOver(handler);
        int Summaries() => handler.Requests.Count(r => r.RequestUri!.AbsolutePath.Contains("/summary"));

        await provider.FetchScoreboardAsync("basketball/nba", CancellationToken.None);
        var unchanged = Assert.Single(await provider.FetchScoreboardAsync("basketball/nba", CancellationToken.None));
        Assert.Equal(1, Summaries());
        Assert.NotNull(unchanged.LastScore);

        (home, away) = (101, 98);
        await provider.FetchScoreboardAsync("basketball/nba", CancellationToken.None);
        Assert.Equal(2, Summaries());
    }

    [Fact]
    public async Task Summary_behind_the_scoreboard_is_asked_for_again_next_time()
    {
        // The scoreboard has a basket the summary doesn't have yet: its last scoring play left it 99-98.
        var handler = BasketballServing(() => BasketballScoreboard(101, 98), () => Fixture("nba-summary.json"));
        var provider = ProviderOver(handler);

        var game = Assert.Single(await provider.FetchScoreboardAsync("basketball/nba", CancellationToken.None));
        await provider.FetchScoreboardAsync("basketball/nba", CancellationToken.None);

        Assert.Equal("ATL", game.LastScore?.Team);
        Assert.Equal(2, handler.Requests.Count(r => r.RequestUri!.AbsolutePath.Contains("/summary")));
    }

    [Fact]
    public async Task Games_not_started_or_still_scoreless_never_ask_for_a_summary()
    {
        var handler = BasketballServing(() => BasketballScoreboard(0, 0), () => throw new InvalidOperationException("Asked for a summary"));
        var provider = ProviderOver(handler);

        var scoreless = Assert.Single(await provider.FetchScoreboardAsync("basketball/nba", CancellationToken.None));
        await FetchFixtureAsync("nfl-scheduled-odds.json", Nfl);

        Assert.Null(scoreless.LastScore);
        Assert.DoesNotContain(handler.Requests, r => r.RequestUri!.AbsolutePath.Contains("/summary"));
    }

    public static TheoryData<string> SummaryFailures => ["error status", "timeout", "not JSON"];

    [Theory]
    [MemberData(nameof(SummaryFailures))]
    public async Task A_failed_summary_keeps_the_last_score_it_had_and_is_tried_again(string failure)
    {
        var (home, failing) = (99, false);
        var handler = BasketballServing(() => BasketballScoreboard(home, 98), () => !failing ? Fixture("nba-summary.json") : failure switch
        {
            "error status" => StubHttpHandler.ServerError,
            "timeout" => throw new TaskCanceledException("The request was canceled due to the configured HttpClient.Timeout of 10 seconds elapsing.",
                new TimeoutException("The operation was canceled.")),
            _ => "<html>Service Unavailable</html>",
        });
        var provider = ProviderOver(handler);
        await provider.FetchScoreboardAsync("basketball/nba", CancellationToken.None);

        (home, failing) = (101, true);
        var game = Assert.Single(await provider.FetchScoreboardAsync("basketball/nba", CancellationToken.None));
        await provider.FetchScoreboardAsync("basketball/nba", CancellationToken.None);

        Assert.Equal((101, "ATL"), (game.Home.Score, game.LastScore?.Team));
        Assert.Equal(3, handler.Requests.Count(r => r.RequestUri!.AbsolutePath.Contains("/summary")));
    }

    [Fact]
    public async Task Cancelling_while_a_summary_is_asked_for_cancels_the_fetch()
    {
        using var cancel = new CancellationTokenSource();
        var handler = BasketballServing(() => BasketballScoreboard(99, 98), () =>
        {
            cancel.Cancel();
            throw new TaskCanceledException("Cancelled", null, cancel.Token);
        });
        var provider = ProviderOver(handler);

        await Assert.ThrowsAnyAsync<OperationCanceledException>(() => provider.FetchScoreboardAsync("basketball/nba", cancel.Token));
    }
}
