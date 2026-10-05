using ScoreMap.Server.GameFeed;
using ScoreMap.Server.Games;
using ScoreMap.Server.Tests.Support;
using static ScoreMap.Server.Tests.Support.ProviderGames;

namespace ScoreMap.Server.Tests;

public class GameStatusTests
{
    [Fact]
    public async Task A_scheduled_game_is_Upcoming()
    {
        await using var server = new ScoreMapServer();
        server.Feed.SetScoreboard("football/nfl", NflGame(server.Clock.GetUtcNow().AddHours(1), ProviderStatus.Scheduled));

        await using var client = await server.ConnectClientAsync();
        var game = Assert.Single(await client.NextSnapshotAsync());

        Assert.Equal(GameStatus.Upcoming, game.Status);
    }

    [Theory]
    [InlineData(ProviderStatus.InProgress, GameStatus.Live)]
    [InlineData(ProviderStatus.Final, GameStatus.Final)]
    public async Task A_started_game_maps_to_its_ScoreMap_status(ProviderStatus providerStatus, GameStatus expected)
    {
        await using var server = new ScoreMapServer();
        server.Feed.SetScoreboard("football/nfl", NflGame(server.Clock.GetUtcNow().AddHours(-1), providerStatus));

        await using var client = await server.ConnectClientAsync();
        var game = Assert.Single(await client.NextSnapshotAsync());

        Assert.Equal(expected, game.Status);
    }

    [Fact]
    public async Task A_delayed_game_stays_Live_and_is_flagged_as_delayed()
    {
        await using var server = new ScoreMapServer();
        server.Feed.SetScoreboard("football/nfl",
            NflGame(server.Clock.GetUtcNow().AddHours(-1), ProviderStatus.Delayed, clock: "8:02", period: 2));

        await using var client = await server.ConnectClientAsync();
        var game = Assert.Single(await client.NextSnapshotAsync());

        Assert.Equal(GameStatus.Live, game.Status);
        Assert.True(game.Delayed);
    }

    // Disrupted games get their own status and pins in ticket #12; until then they get no pin.
    [Theory]
    [InlineData(ProviderStatus.Postponed)]
    [InlineData(ProviderStatus.Suspended)]
    [InlineData(ProviderStatus.Canceled)]
    public async Task A_disrupted_game_is_not_shown_as_Upcoming_Live_or_Final(ProviderStatus providerStatus)
    {
        await using var server = new ScoreMapServer();
        server.Feed.SetScoreboard("football/nfl", NflGame(server.Clock.GetUtcNow().AddHours(1), providerStatus));

        await using var client = await server.ConnectClientAsync();

        Assert.Empty(await client.NextSnapshotAsync());
    }

    [Fact]
    public async Task A_game_in_progress_is_not_delayed()
    {
        await using var server = new ScoreMapServer();
        server.Feed.SetScoreboard("football/nfl",
            NflGame(server.Clock.GetUtcNow().AddHours(-1), ProviderStatus.InProgress, clock: "8:02", period: 2));

        await using var client = await server.ConnectClientAsync();
        var game = Assert.Single(await client.NextSnapshotAsync());

        Assert.False(game.Delayed);
    }
}
