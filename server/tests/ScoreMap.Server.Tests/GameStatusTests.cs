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

    [Theory]
    [InlineData(ProviderStatus.Postponed, Disruption.Postponed)]
    [InlineData(ProviderStatus.Suspended, Disruption.Suspended)]
    [InlineData(ProviderStatus.Canceled, Disruption.Canceled)]
    public async Task A_disrupted_game_is_Disrupted_and_says_which_kind(ProviderStatus providerStatus, Disruption expected)
    {
        await using var server = new ScoreMapServer();
        server.Feed.SetScoreboard("football/nfl", NflGame(server.Clock.GetUtcNow().AddHours(1), providerStatus));

        await using var client = await server.ConnectClientAsync();
        var game = Assert.Single(await client.NextSnapshotAsync());

        Assert.Equal(GameStatus.Disrupted, game.Status);
        Assert.Equal(expected, game.Disruption);
    }

    [Theory]
    [InlineData(ProviderStatus.Scheduled)]
    [InlineData(ProviderStatus.InProgress)]
    [InlineData(ProviderStatus.Delayed)]
    [InlineData(ProviderStatus.Final)]
    public async Task A_game_that_is_not_disrupted_has_no_disruption(ProviderStatus providerStatus)
    {
        await using var server = new ScoreMapServer();
        server.Feed.SetScoreboard("football/nfl", NflGame(server.Clock.GetUtcNow().AddHours(-1), providerStatus));

        await using var client = await server.ConnectClientAsync();
        var game = Assert.Single(await client.NextSnapshotAsync());

        Assert.Null(game.Disruption);
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
