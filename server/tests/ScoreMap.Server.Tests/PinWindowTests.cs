using ScoreMap.Server.GameFeed;
using ScoreMap.Server.Tests.Support;
using static ScoreMap.Server.Tests.Support.ProviderGames;

namespace ScoreMap.Server.Tests;

public class PinWindowTests
{
    [Fact]
    public async Task An_Upcoming_game_has_no_pin_earlier_than_3_hours_before_its_start()
    {
        await using var server = new ScoreMapServer();
        var start = server.Clock.GetUtcNow().AddHours(3).AddMinutes(1);
        server.Feed.SetScoreboard("football/nfl", NflGame(start, ProviderStatus.Scheduled));

        await using var client = await server.ConnectClientAsync();

        Assert.Empty(await client.NextSnapshotAsync());
    }

    [Fact]
    public async Task An_Upcoming_game_gets_its_pin_from_3_hours_before_its_start()
    {
        await using var server = new ScoreMapServer();
        var start = server.Clock.GetUtcNow().AddHours(3);
        server.Feed.SetScoreboard("football/nfl", NflGame(start, ProviderStatus.Scheduled));

        await using var client = await server.ConnectClientAsync();

        Assert.Single(await client.NextSnapshotAsync());
    }

    // ESPN reports no end time, so a game ends when the server first sees it Final.
    private static async Task<DateTimeOffset> SeeGameFinishAsync(ScoreMapServer server)
    {
        var start = server.Clock.GetUtcNow().AddHours(-3);
        server.Feed.SetScoreboard("football/nfl", NflGame(start, ProviderStatus.InProgress));
        await using (var watching = await server.ConnectClientAsync())
            await watching.NextSnapshotAsync();

        server.Clock.Advance(TimeSpan.FromMinutes(5));
        var end = server.Clock.GetUtcNow();
        server.Feed.SetScoreboard("football/nfl", NflGame(start, ProviderStatus.Final));
        await using (var watching = await server.ConnectClientAsync())
            await watching.NextSnapshotAsync();
        return end;
    }

    [Fact]
    public async Task A_Final_game_carries_the_time_it_ended()
    {
        await using var server = new ScoreMapServer();
        var end = await SeeGameFinishAsync(server);

        server.Clock.Advance(TimeSpan.FromMinutes(30));
        await using var client = await server.ConnectClientAsync();
        var game = Assert.Single(await client.NextSnapshotAsync());

        Assert.Equal(end, game.EndTime);
    }

    [Fact]
    public async Task A_Final_game_keeps_its_pin_until_2_hours_after_it_ends()
    {
        await using var server = new ScoreMapServer();
        await SeeGameFinishAsync(server);

        server.Clock.Advance(TimeSpan.FromHours(2) - TimeSpan.FromMinutes(1));
        await using var client = await server.ConnectClientAsync();

        Assert.Single(await client.NextSnapshotAsync());
    }

    [Fact]
    public async Task A_Final_game_loses_its_pin_2_hours_after_it_ends()
    {
        await using var server = new ScoreMapServer();
        await SeeGameFinishAsync(server);

        server.Clock.Advance(TimeSpan.FromHours(2));
        await using var client = await server.ConnectClientAsync();

        Assert.Empty(await client.NextSnapshotAsync());
    }
}
