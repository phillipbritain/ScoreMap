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
}
