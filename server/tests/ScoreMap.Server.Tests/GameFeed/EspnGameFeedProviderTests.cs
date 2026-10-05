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
        Assert.Equal(new ProviderVenue("Tottenham Hotspur Stadium", "London", null, "England"), london.Venue);
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
        Assert.Equal(new ProviderVenue("Bank of America Stadium", "Charlotte", "NC", "USA"), game.Venue);
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
        Assert.Equal(new ProviderVenue("Dodger Stadium", "Los Angeles", "California", null), game.Venue);
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
        Assert.Equal(new ProviderVenue("Palazzo dello Sport", "Rome", "Italy", null), game.Venue);
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
        Assert.Equal(new ProviderVenue("The City Ground", "Nottingham", null, "England"), game.Venue);
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
        Assert.Equal(new ProviderVenue("Soldier Field", "Chicago, Illinois", null, "USA"), game.Venue);
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

    [Fact]
    public async Task Asks_for_the_league_scoreboard_of_todays_US_Eastern_day()
    {
        // 02:00 UTC on 5 Oct is still 4 Oct in New York.
        var handler = StubHttpHandler.Returning("""{"events":[]}""");
        var provider = new EspnGameFeedProvider(
            new HttpClient(handler) { BaseAddress = new Uri("https://espn.test/sports/") },
            new FakeTimeProvider(new DateTimeOffset(2026, 10, 5, 2, 0, 0, TimeSpan.Zero)));

        await provider.FetchScoreboardAsync(Nfl, CancellationToken.None);

        var request = Assert.Single(handler.Requests);
        Assert.Equal("https://espn.test/sports/football/nfl/scoreboard?dates=20261004&limit=500", request.RequestUri!.ToString());
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

        var request = Assert.Single(handler.Requests);
        Assert.Equal("https://espn.test/sports/basketball/mens-college-basketball/scoreboard?groups=50&dates=20261004&limit=500",
            request.RequestUri!.ToString());
    }
}
