using ScoreMap.Server.Tests.Support;
using static ScoreMap.Server.Tests.Support.TestGames;

namespace ScoreMap.Server.Tests.Live;

public class PollingTests
{
    [Fact]
    public async Task A_league_with_live_games_is_polled_every_15_seconds()
    {
        await using var server = new ScoreMapServer();
        server.Feed.SetScoreboard(Nfl, LiveGame(server.Clock, "401"));
        await using var client = await server.ConnectClientAsync();
        await client.NextSnapshotAsync();

        for (var fetches = 2; fetches <= 4; fetches++)
        {
            server.Clock.Advance(TimeSpan.FromSeconds(15));
            await server.Feed.WaitForFetchesAsync(Nfl, fetches);
        }
    }

    [Fact]
    public async Task A_league_without_live_games_is_polled_every_3_minutes()
    {
        await using var server = new ScoreMapServer();
        server.Feed.SetScoreboard(Nfl, UpcomingGame(server.Clock, "401"));
        await using var client = await server.ConnectClientAsync();
        await client.NextSnapshotAsync();

        server.Clock.Advance(TimeSpan.FromSeconds(15));
        await Settle();
        Assert.Equal(1, server.Feed.Fetches(Nfl));

        server.Clock.Advance(TimeSpan.FromMinutes(3) - TimeSpan.FromSeconds(15));
        await server.Feed.WaitForFetchesAsync(Nfl, 2);
    }

    [Fact]
    public async Task Polling_stops_when_no_browser_is_connected()
    {
        await using var server = new ScoreMapServer();
        server.Feed.SetScoreboard(Nfl, LiveGame(server.Clock, "401"));
        var client = await server.ConnectClientAsync();
        await client.NextSnapshotAsync();

        await server.DisconnectAsync(client);
        for (var i = 0; i < 20; i++)
            server.Clock.Advance(TimeSpan.FromSeconds(15));
        await Settle();

        Assert.Equal(1, server.Feed.Fetches(Nfl));
    }

    [Fact]
    public async Task Polling_resumes_when_a_browser_connects_again()
    {
        await using var server = new ScoreMapServer();
        server.Feed.SetScoreboard(Nfl, LiveGame(server.Clock, "401"));
        var first = await server.ConnectClientAsync();
        await first.NextSnapshotAsync();
        await server.DisconnectAsync(first);
        server.Clock.Advance(TimeSpan.FromMinutes(10));

        await using var second = await server.ConnectClientAsync();
        await second.NextSnapshotAsync();
        server.Clock.Advance(TimeSpan.FromSeconds(15));

        await server.Feed.WaitForFetchesAsync(Nfl, 3);
    }

    [Fact]
    public async Task A_reconnecting_browser_catches_up_through_a_fresh_snapshot()
    {
        await using var server = new ScoreMapServer();
        var game = LiveGame(server.Clock, "401", homeScore: 21, awayScore: 17);
        server.Feed.SetScoreboard(Nfl, game);
        var dropped = await server.ConnectClientAsync();
        await dropped.NextSnapshotAsync();
        await server.DisconnectAsync(dropped);

        server.Feed.SetScoreboard(Nfl, game with { Home = game.Home with { Score = 28 } });
        server.Clock.Advance(TimeSpan.FromMinutes(1));
        await using var reconnected = await server.ConnectClientAsync();

        var snapshot = await reconnected.NextSnapshotAsync();
        Assert.Equal(28, Assert.Single(snapshot).Home.Score);
    }

    [Fact]
    public async Task After_every_browser_leaves_for_hours_the_next_one_gets_fresh_games_and_polling_resumes()
    {
        // What an idle host that sleeps sees: everyone goes, a long gap, then someone comes back.
        await using var server = new ScoreMapServer();
        server.Feed.SetScoreboard(Nfl, UpcomingGame(server.Clock, "401"));
        var phone = await server.ConnectClientAsync();
        var laptop = await server.ConnectClientAsync();
        await phone.NextSnapshotAsync();
        await laptop.NextSnapshotAsync();
        await server.DisconnectAsync(phone);
        await server.DisconnectAsync(laptop);

        server.Clock.Advance(TimeSpan.FromHours(8));
        server.Feed.SetScoreboard(Nfl, LiveGame(server.Clock, "401", homeScore: 7));
        await Settle();
        var fetchesWhileAway = server.Feed.Fetches(Nfl);

        await using var returning = await server.ConnectClientAsync();
        var snapshot = await returning.NextSnapshotAsync();
        Assert.Equal(7, Assert.Single(snapshot).Home.Score);

        server.Feed.SetScoreboard(Nfl, LiveGame(server.Clock, "401", homeScore: 14));
        server.Clock.Advance(TimeSpan.FromSeconds(15));
        var change = await returning.NextChangeAsync();

        Assert.Equal(1, fetchesWhileAway);
        Assert.Equal(14, change.Game.Home.Score);
    }

    /// <summary>Gives the server real time to act on the clock before asserting that nothing happened.</summary>
    private static Task Settle() => Task.Delay(TimeSpan.FromMilliseconds(300));
}
