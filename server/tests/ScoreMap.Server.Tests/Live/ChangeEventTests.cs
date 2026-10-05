using ScoreMap.Server.GameFeed;
using ScoreMap.Server.Games;
using ScoreMap.Server.Tests.Support;
using static ScoreMap.Server.Tests.Support.TestGames;

namespace ScoreMap.Server.Tests.Live;

public class ChangeEventTests
{
    [Fact]
    public async Task A_score_change_is_pushed_to_connected_clients()
    {
        await using var server = new ScoreMapServer();
        var game = LiveGame(server.Clock, "401", homeScore: 21, awayScore: 17);
        server.Feed.SetScoreboard(Nfl, game);
        await using var client = await server.ConnectClientAsync();
        await client.NextSnapshotAsync();

        server.Feed.SetScoreboard(Nfl, game with { Home = game.Home with { Score = 24 } });
        server.Clock.Advance(TimeSpan.FromSeconds(15));

        var change = await client.NextChangeAsync();
        Assert.Equal(GameChangeKind.ScoreChanged, change.Kind);
        Assert.Equal("401", change.Game.Id);
        Assert.Equal(24, change.Game.Home.Score);
    }

    [Fact]
    public async Task A_new_game_is_pushed_as_added()
    {
        await using var server = new ScoreMapServer();
        var first = LiveGame(server.Clock, "401");
        server.Feed.SetScoreboard(Nfl, first);
        await using var client = await server.ConnectClientAsync();
        await client.NextSnapshotAsync();

        server.Feed.SetScoreboard(Nfl, first, UpcomingGame(server.Clock, "402"));
        server.Clock.Advance(TimeSpan.FromSeconds(15));

        var change = await client.NextChangeAsync();
        Assert.Equal(GameChangeKind.Added, change.Kind);
        Assert.Equal("402", change.Game.Id);
    }

    [Fact]
    public async Task A_game_gone_from_the_feed_is_pushed_as_removed_with_its_last_state()
    {
        await using var server = new ScoreMapServer();
        var staying = LiveGame(server.Clock, "401");
        server.Feed.SetScoreboard(Nfl, staying, LiveGame(server.Clock, "402", homeScore: 7));
        await using var client = await server.ConnectClientAsync();
        await client.NextSnapshotAsync();

        server.Feed.SetScoreboard(Nfl, staying);
        server.Clock.Advance(TimeSpan.FromSeconds(15));

        var change = await client.NextChangeAsync();
        Assert.Equal(GameChangeKind.Removed, change.Kind);
        Assert.Equal("402", change.Game.Id);
        Assert.Equal(7, change.Game.Home.Score);
    }

    [Fact]
    public async Task An_upcoming_game_going_live_is_pushed_once_as_started()
    {
        await using var server = new ScoreMapServer();
        var upcoming = UpcomingGame(server.Clock, "401");
        server.Feed.SetScoreboard(Nfl, upcoming);
        await using var client = await server.ConnectClientAsync();
        await client.NextSnapshotAsync();

        server.Feed.SetScoreboard(Nfl, upcoming with
        {
            Status = ProviderStatus.InProgress,
            Home = upcoming.Home with { Score = 0 },
            Away = upcoming.Away with { Score = 0 },
            DisplayClock = "15:00",
            Period = 1,
        });
        server.Clock.Advance(TimeSpan.FromMinutes(3));

        var change = await client.NextChangeAsync();
        Assert.Equal(GameChangeKind.Started, change.Kind);
        Assert.Equal(0, change.Game.Home.Score);
        Assert.Equal("15:00", change.Game.Clock);
        Assert.Empty(client.PendingChanges());
    }

    [Fact]
    public async Task A_live_game_ending_is_pushed_as_finished()
    {
        await using var server = new ScoreMapServer();
        var live = LiveGame(server.Clock, "401", homeScore: 21, awayScore: 17);
        server.Feed.SetScoreboard(Nfl, live);
        await using var client = await server.ConnectClientAsync();
        await client.NextSnapshotAsync();

        server.Feed.SetScoreboard(Nfl, live with { Status = ProviderStatus.Final, DisplayClock = "0:00", Period = 4 });
        server.Clock.Advance(TimeSpan.FromSeconds(15));

        var change = await client.NextChangeAsync();
        Assert.Equal(GameChangeKind.Finished, change.Kind);
        Assert.Equal(4, change.Game.Period);
    }

    [Fact]
    public async Task A_clock_or_period_change_is_pushed_as_updated()
    {
        await using var server = new ScoreMapServer();
        var live = LiveGame(server.Clock, "401", homeScore: 21, awayScore: 17);
        server.Feed.SetScoreboard(Nfl, live);
        await using var client = await server.ConnectClientAsync();
        await client.NextSnapshotAsync();

        server.Feed.SetScoreboard(Nfl, live with { DisplayClock = "15:00", Period = 4 });
        server.Clock.Advance(TimeSpan.FromSeconds(15));

        var change = await client.NextChangeAsync();
        Assert.Equal(GameChangeKind.Updated, change.Kind);
        Assert.Equal(("15:00", 4), (change.Game.Clock, change.Game.Period));
    }

    [Fact]
    public async Task An_unchanged_game_pushes_nothing()
    {
        await using var server = new ScoreMapServer();
        var live = LiveGame(server.Clock, "401");
        server.Feed.SetScoreboard(Nfl, live);
        await using var client = await server.ConnectClientAsync();
        await client.NextSnapshotAsync();

        // Poll once unchanged, then once with a change: the change must be the first event.
        server.Clock.Advance(TimeSpan.FromSeconds(15));
        await server.Feed.WaitForFetchesAsync(Nfl, 2);
        server.Feed.SetScoreboard(Nfl, live with { DisplayClock = "1:00" });
        server.Clock.Advance(TimeSpan.FromSeconds(15));

        var change = await client.NextChangeAsync();
        Assert.Equal("1:00", change.Game.Clock);
    }
}
