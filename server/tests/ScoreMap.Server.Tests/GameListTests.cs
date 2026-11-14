using System.Net;
using ScoreMap.Server.GameFeed;
using ScoreMap.Server.Tests.Support;
using static ScoreMap.Server.Tests.Support.TestGames;

namespace ScoreMap.Server.Tests;

/// <summary>The board's games listed one line each, for an agent driving a local run.</summary>
public class GameListTests
{
    private const string CollegeFootball = "football/college-football";

    private static ProviderGame RankedCollegeGame(ScoreMapServer server)
    {
        var game = LiveGame(server.Clock, "cfb", 14, 10, CollegeFootball);
        // ESPN's SEC is 8 in football.
        return game with
        {
            Contest = new ProviderSides(
                new ProviderTeam("UGA", "Georgia Bulldogs", null, 14, Rank: 5, ConferenceId: "8"),
                new ProviderTeam("BAMA", "Alabama Crimson Tide", null, 10, Rank: 12, ConferenceId: "8")),
        };
    }

    [Fact]
    public async Task Run_locally_the_server_lists_each_game_on_one_line_and_keeps_the_leagues_asked_for()
    {
        await using var server = new ScoreMapServer();
        server.Feed.SetScoreboard(CollegeFootball, RankedCollegeGame(server));
        server.Feed.SetScoreboard(Nfl, UpcomingGame(server.Clock, "nfl"));
        await using var client = await server.ConnectClientAsync();
        await client.NextSnapshotAsync();
        using var http = server.CreateClient();
        var ct = TestContext.Current.CancellationToken;

        var all = await http.GetStringAsync("/api/games", ct);
        var college = await http.GetStringAsync("/api/games?league=ncaa", ct);

        Assert.Equal(
            "cfb | NCAA Football | Live Q3 4:12 | #12 BAMA (SEC) 10 @ #5 UGA (SEC) 14 | GEHA Field at Arrowhead Stadium, Kansas City\n"
            + "nfl | NFL | Upcoming | BUF @ KC | GEHA Field at Arrowhead Stadium, Kansas City\n",
            all);
        Assert.Equal(all.Split('\n')[0] + "\n", college);
        Assert.Contains("No games in a league matching \"mlb\"", await http.GetStringAsync("/api/games?league=mlb", ct));
    }

    [Fact]
    public async Task Outside_development_there_is_no_game_list()
    {
        await using var server = new ScoreMapServer { Environment = "Production" };
        using var http = server.CreateClient();

        var response = await http.GetAsync("/api/games", TestContext.Current.CancellationToken);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }
}
