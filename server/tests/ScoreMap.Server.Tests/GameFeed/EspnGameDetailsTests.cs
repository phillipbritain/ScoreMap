using System.Net;
using System.Net.Http.Json;
using Microsoft.Extensions.Time.Testing;
using ScoreMap.Server.GameFeed;
using ScoreMap.Server.Games;
using ScoreMap.Server.Tests.Support;

namespace ScoreMap.Server.Tests.GameFeed;

public class EspnGameDetailsTests
{
    private static League Football => new() { Key = "football/college-football", Name = "NCAA Football", Sport = Sport.Football };

    [Fact]
    public async Task Game_details_endpoint_looks_up_only_games_on_the_board()
    {
        const string scoreboard = """
            {"events":[{"id":"401761625","date":"2026-10-04T17:00:00Z","competitions":[
              {"venue":{"fullName":"Bridgeforth Stadium","address":{"city":"Harrisonburg","state":"VA","country":"USA"}},
               "competitors":[
                 {"homeAway":"home","team":{"abbreviation":"JMU","displayName":"James Madison"},"score":"24"},
                 {"homeAway":"away","team":{"abbreviation":"UL","displayName":"Louisiana"},"score":"14"}],
               "status":{"period":4,"type":{"name":"STATUS_IN_PROGRESS","state":"in"}}}]}]}
            """;
        var handler = new StubHttpHandler(request => request.RequestUri!.AbsolutePath switch
        {
            "/sports/football/college-football/scoreboard" => scoreboard,
            "/sports/football/college-football/summary" => Fixture("college-football-game-details.json"),
            _ => "{}",
        });
        await using var server = new ScoreMapServer { FeedProvider = Provider(handler) };
        await using var viewer = await server.ConnectClientAsync();
        Assert.Contains(await viewer.NextSnapshotAsync(), game => game.Id == "401761625");
        using var http = server.CreateClient();
        var cancellationToken = TestContext.Current.CancellationToken;

        using var missing = await http.GetAsync("/api/game-details?id=999&league=NCAA%20Football", cancellationToken);
        Assert.Equal(HttpStatusCode.NotFound, missing.StatusCode);
        lock (handler.Requests)
            Assert.DoesNotContain(handler.Requests, request => request.RequestUri!.AbsolutePath.EndsWith("/summary"));

        var details = await http.GetFromJsonAsync<GameDetails>("/api/game-details?id=401761625&league=NCAA%20Football", cancellationToken);

        Assert.NotNull(details);
        Assert.Equal("ESPN2", Assert.Single(details.Broadcasts));
    }

    [Fact]
    public async Task Selected_football_game_carries_period_scores_scoring_drives_stats_videos_and_broadcasts()
    {
        var handler = StubHttpHandler.Returning(Fixture("college-football-game-details.json"));
        var provider = Provider(handler);
        var cancellationToken = TestContext.Current.CancellationToken;

        var details = await provider.FetchGameDetailsAsync(Football, "401761625", cancellationToken);

        Assert.NotNull(details);
        Assert.Equal(("24", "14"), (details.HomeTotal, details.AwayTotal));
        Assert.Equal(new GamePeriodScore("Q2", "7", "14"), details.PeriodScores[1]);
        Assert.Equal(new GameScoringPlay("UL", "Brock Chappell 5 Yd pass from Lunch Winfield (Tony Sterner Kick)",
            "Q2 8:33", 0, 7), details.Scoring[0]);
        Assert.Equal(new GameDrive("UL", "Punt", false, 3, 4, "1:28", "UL 25", "UL 29"), Assert.Single(details.Drives));
        var passing = Assert.Single(details.Stats.Single(team => team.Team == "UL").Sections);
        Assert.Equal("C/ATT", passing.Columns[0]);
        Assert.Equal("Lunch Winfield", Assert.Single(passing.Players).Name);
        Assert.Equal("https://www.espn.com/video/clip?id=46563597", Assert.Single(details.Videos).Url);
        Assert.Equal("ESPN2", Assert.Single(details.Broadcasts));

        Assert.Same(details, await provider.FetchGameDetailsAsync(Football, "401761625", cancellationToken));
        Assert.Equal("/sports/football/college-football/summary?event=401761625",
            Assert.Single(handler.Requests).RequestUri!.PathAndQuery);
    }

    [Theory]
    [InlineData(Sport.Baseball, "baseball/mlb", "mlb-summary.json", "PHI", "Top 10th", "Bohm homered to right (357 feet).")]
    [InlineData(Sport.Basketball, "basketball/nba", "nba-summary.json", "ATL", "Q4 1.8",
        "Nickeil Alexander-Walker makes 22-foot three point jumper (Jalen Johnson assists)")]
    [InlineData(Sport.Hockey, "hockey/mens-college-hockey", "college-hockey-summary.json", "DEN", "P3 14:08",
        "Even Strength Goal Scored by Kyle Chyzowski assisted by Boston Buckberger and Garrett Brown")]
    public async Task Scoring_uses_the_marked_plays_and_each_sports_clock(
        Sport sport, string key, string fixture, string team, string when, string text)
    {
        var provider = Provider(StubHttpHandler.Returning(Fixture(fixture)));
        var league = new League { Name = key, Key = key, Sport = sport };

        var details = await provider.FetchGameDetailsAsync(league, "1", TestContext.Current.CancellationToken);

        Assert.NotNull(details);
        Assert.Equal((team, when, text), (details.Scoring[^1].Team, details.Scoring[^1].When, details.Scoring[^1].Text));
        Assert.Empty(details.Drives);
    }

    [Fact]
    public async Task Feed_error_does_not_break_the_scoreboard_or_reuse_another_games_details()
    {
        var handler = StubHttpHandler.Serving(
            ("https://espn.test/sports/football/college-football/summary?event=401761625", Fixture("college-football-game-details.json")),
            ("https://espn.test/sports/football/college-football/summary?event=404", StubHttpHandler.ServerError));
        var provider = Provider(handler);
        var cancellationToken = TestContext.Current.CancellationToken;

        Assert.NotNull(await provider.FetchGameDetailsAsync(Football, "401761625", cancellationToken));
        Assert.Null(await provider.FetchGameDetailsAsync(Football, "404", cancellationToken));
        Assert.Same(GameDetails.Empty, await provider.FetchGameDetailsAsync(Football, "scenario-game", cancellationToken));
        Assert.Equal(2, handler.Requests.Count);
    }

    private static string Fixture(string filename) =>
        File.ReadAllText(Path.Combine(AppContext.BaseDirectory, "Fixtures", "Espn", filename));

    private static EspnGameFeedProvider Provider(StubHttpHandler handler) =>
        new(new HttpClient(handler) { BaseAddress = new Uri("https://espn.test/sports/") }, new FakeTimeProvider());
}
