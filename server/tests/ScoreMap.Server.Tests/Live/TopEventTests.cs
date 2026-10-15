using ScoreMap.Server.Games;
using ScoreMap.Server.Tests.Support;
using static ScoreMap.Server.Tests.Support.TestGames;

namespace ScoreMap.Server.Tests.Live;

public class TopEventTests
{
    [Fact]
    public async Task A_game_the_feed_lists_as_a_top_event_comes_marked_and_the_others_do_not()
    {
        await using var server = new ScoreMapServer();
        server.Feed.SetScoreboard(Nfl, LiveGame(server.Clock, "401"), LiveGame(server.Clock, "402"));
        server.Feed.SetTopEvents("401", "999");
        await using var client = await server.ConnectClientAsync();

        var games = await client.NextSnapshotAsync();

        Assert.True(games.Single(g => g.Id == "401").TopEvent);
        Assert.False(games.Single(g => g.Id == "402").TopEvent);
    }

    [Fact]
    public async Task A_game_becoming_a_top_event_is_pushed_as_updated_once_the_top_events_are_fetched_again()
    {
        await using var server = new ScoreMapServer();
        server.Feed.SetScoreboard(Nfl, LiveGame(server.Clock, "401"));
        await using var client = await server.ConnectClientAsync();
        Assert.False(Assert.Single(await client.NextSnapshotAsync()).TopEvent);

        server.Feed.SetTopEvents("401");
        // Live leagues are fetched every 15 s, the top events every 3 minutes.
        server.Clock.Advance(TimeSpan.FromSeconds(15));
        await server.Feed.WaitForFetchesAsync(Nfl, 2);
        Assert.Empty(client.PendingChanges());
        server.Clock.Advance(TimeSpan.FromMinutes(3) - TimeSpan.FromSeconds(15));

        var change = await client.NextChangeAsync();
        Assert.Equal((GameChangeKind.Updated, "401", true), (change.Kind, change.Game.Id, change.Game.TopEvent));
    }

    [Fact]
    public async Task Top_events_that_fail_to_load_leave_the_games_coming_unmarked()
    {
        await using var server = new ScoreMapServer();
        server.Feed.SetScoreboard(Nfl, LiveGame(server.Clock, "401"));
        server.Feed.FailTopEvents();
        await using var client = await server.ConnectClientAsync();

        var game = Assert.Single(await client.NextSnapshotAsync());

        Assert.Equal(("401", false), (game.Id, game.TopEvent));
        Assert.Equal(1, server.Feed.TopEventsFetches);
    }
}
