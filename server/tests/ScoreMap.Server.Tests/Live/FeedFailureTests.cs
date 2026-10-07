using ScoreMap.Server.Games;
using ScoreMap.Server.Tests.Support;
using static ScoreMap.Server.Tests.Support.TestGames;

namespace ScoreMap.Server.Tests.Live;

public class FeedFailureTests
{
    private const string Nba = "basketball/test-nba";

    [Fact]
    public async Task A_league_whose_feed_fails_does_not_stop_other_leagues_updating()
    {
        await using var server = new ScoreMapServer();
        server.AddLeague(Nba, "NBA", "Basketball");
        server.Feed.Fail(Nfl);
        var game = LiveGame(server.Clock, "501", homeScore: 50, awayScore: 48, leagueKey: Nba);
        server.Feed.SetScoreboard(Nba, game);
        await using var client = await server.ConnectClientAsync();

        Assert.Equal("501", Assert.Single(await client.NextSnapshotAsync()).Id);

        server.Feed.SetScoreboard(Nba, game with { Home = game.Home with { Score = 52 } });
        server.Clock.Advance(TimeSpan.FromSeconds(15));

        var change = await client.NextChangeAsync();
        Assert.Equal((GameChangeKind.ScoreChanged, 52), (change.Kind, change.Game.Home.Score));
    }

    [Fact]
    public async Task A_league_whose_feed_fails_keeps_its_last_known_games_and_is_retried()
    {
        await using var server = new ScoreMapServer();
        server.Feed.SetScoreboard(Nfl, LiveGame(server.Clock, "401", homeScore: 21));
        await using var first = await server.ConnectClientAsync();
        await first.NextSnapshotAsync();

        server.Feed.Fail(Nfl);
        server.Clock.Advance(TimeSpan.FromSeconds(15));
        await server.Feed.WaitForFetchesAsync(Nfl, 2);
        server.Clock.Advance(TimeSpan.FromSeconds(15));
        await server.Feed.WaitForFetchesAsync(Nfl, 3);

        await using var second = await server.ConnectClientAsync();
        var game = Assert.Single(await second.NextSnapshotAsync());
        Assert.Equal(("401", 21), (game.Id, game.Home.Score));
        Assert.Empty(first.PendingChanges());
    }

    [Fact]
    public async Task A_failing_feed_does_not_stop_polling()
    {
        await using var server = new ScoreMapServer();
        server.Feed.Fail(Nfl);
        await using var client = await server.ConnectClientAsync();
        Assert.Empty(await client.NextSnapshotAsync());

        server.Clock.Advance(TimeSpan.FromMinutes(3));

        await server.Feed.WaitForFetchesAsync(Nfl, 2);
    }

    [Fact]
    public async Task A_league_whose_feed_times_out_does_not_stop_other_leagues_showing()
    {
        await using var server = new ScoreMapServer();
        server.AddLeague(Nba, "NBA", "Basketball");
        server.Feed.TimeOut(Nfl);
        server.Feed.SetScoreboard(Nba, LiveGame(server.Clock, "501", leagueKey: Nba));
        await using var client = await server.ConnectClientAsync();

        Assert.Equal("501", Assert.Single(await client.NextSnapshotAsync()).Id);
    }

    [Fact]
    public async Task A_feed_that_times_out_does_not_stop_polling()
    {
        await using var server = new ScoreMapServer();
        server.Feed.SetScoreboard(Nfl, LiveGame(server.Clock, "401"));
        await using var client = await server.ConnectClientAsync();
        await client.NextSnapshotAsync();

        server.Feed.TimeOut(Nfl);
        server.Clock.Advance(TimeSpan.FromSeconds(15));
        await server.Feed.WaitForFetchesAsync(Nfl, 2);
        server.Clock.Advance(TimeSpan.FromMinutes(3));

        await server.Feed.WaitForFetchesAsync(Nfl, 3);
    }
}
