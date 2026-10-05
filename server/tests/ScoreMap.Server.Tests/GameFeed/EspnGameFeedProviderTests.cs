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
    public async Task Asks_for_the_league_scoreboard_of_todays_US_Eastern_day()
    {
        // 02:00 UTC on 5 Oct is still 4 Oct in New York.
        var handler = StubHttpHandler.Returning("""{"events":[]}""");
        var provider = new EspnGameFeedProvider(
            new HttpClient(handler) { BaseAddress = new Uri("https://espn.test/sports/") },
            new FakeTimeProvider(new DateTimeOffset(2026, 10, 5, 2, 0, 0, TimeSpan.Zero)));

        await provider.FetchScoreboardAsync(Nfl, CancellationToken.None);

        var request = Assert.Single(handler.Requests);
        Assert.Equal("https://espn.test/sports/football/nfl/scoreboard?dates=20261004", request.RequestUri!.ToString());
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

        Assert.Single(handler.Requests);
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
}
