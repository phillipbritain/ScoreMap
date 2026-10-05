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
        await server.SnapshotOnceAsync();

        server.Clock.Advance(TimeSpan.FromMinutes(5));
        var end = server.Clock.GetUtcNow();
        server.Feed.SetScoreboard("football/nfl", NflGame(start, ProviderStatus.Final));
        await server.SnapshotOnceAsync();
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

    [Theory]
    [InlineData(ProviderStatus.Postponed)]
    [InlineData(ProviderStatus.Canceled)]
    [InlineData(ProviderStatus.Suspended)]
    public async Task A_Disrupted_game_has_no_pin_earlier_than_3_hours_before_its_planned_start(ProviderStatus disruption)
    {
        await using var server = new ScoreMapServer();
        var start = server.Clock.GetUtcNow().AddHours(3).AddMinutes(1);
        server.Feed.SetScoreboard("football/nfl", NflGame(start, disruption));

        await using var client = await server.ConnectClientAsync();

        Assert.Empty(await client.NextSnapshotAsync());
    }

    // A league whose games are planned to last 2½ hours, so a game starting at T is planned to end at T + 2½ h.
    private static ScoreMapServer ServerWithLeagueOfPlannedLength2AndAHalfHours()
    {
        var server = new ScoreMapServer();
        server.AddLeague("test/league", "Test League", "Test sport", TimeSpan.FromMinutes(150));
        return server;
    }

    private static ProviderGame TestLeagueGame(DateTimeOffset start, ProviderStatus status) =>
        TestGames.Game("t1", "test/league", start, status, null, null, null, null);

    [Theory]
    [InlineData(ProviderStatus.Postponed)]
    [InlineData(ProviderStatus.Canceled)]
    public async Task A_Disrupted_game_keeps_its_pin_until_2_hours_after_its_planned_end(ProviderStatus disruption)
    {
        await using var server = ServerWithLeagueOfPlannedLength2AndAHalfHours();
        var start = server.Clock.GetUtcNow() - TimeSpan.FromHours(4.5) + TimeSpan.FromMinutes(1);
        server.Feed.SetScoreboard("test/league", TestLeagueGame(start, disruption));

        await using var client = await server.ConnectClientAsync();

        Assert.Single(await client.NextSnapshotAsync());
    }

    [Theory]
    [InlineData(ProviderStatus.Postponed)]
    [InlineData(ProviderStatus.Canceled)]
    public async Task A_Disrupted_game_loses_its_pin_2_hours_after_its_planned_end(ProviderStatus disruption)
    {
        await using var server = ServerWithLeagueOfPlannedLength2AndAHalfHours();
        var start = server.Clock.GetUtcNow() - TimeSpan.FromHours(4.5);
        server.Feed.SetScoreboard("test/league", TestLeagueGame(start, disruption));

        await using var client = await server.ConnectClientAsync();

        Assert.Empty(await client.NextSnapshotAsync());
    }

    // ESPN reports no suspension time, so a game is suspended when the server first sees it Suspended.
    // The game is seen in progress, then seen suspended `suspendedAfter` into play, which is the test's "now".
    private static async Task SeeGameSuspendAsync(ScoreMapServer server, TimeSpan suspendedAfter)
    {
        var start = server.Clock.GetUtcNow() + TimeSpan.FromMinutes(5) - suspendedAfter;
        server.Feed.SetScoreboard("test/league", TestLeagueGame(start, ProviderStatus.InProgress));
        await server.SnapshotOnceAsync();

        server.Clock.Advance(TimeSpan.FromMinutes(5));
        server.Feed.SetScoreboard("test/league", TestLeagueGame(start, ProviderStatus.Suspended));
        await server.SnapshotOnceAsync();
    }

    [Fact]
    public async Task A_suspended_game_keeps_its_pin_until_2_hours_after_the_suspension_even_past_its_planned_end()
    {
        await using var server = ServerWithLeagueOfPlannedLength2AndAHalfHours();
        // Suspended 3 hours in, past the planned end; the original schedule's window closes 1½ hours later.
        await SeeGameSuspendAsync(server, TimeSpan.FromHours(3));

        server.Clock.Advance(TimeSpan.FromHours(2) - TimeSpan.FromMinutes(1));
        await using var client = await server.ConnectClientAsync();

        Assert.Single(await client.NextSnapshotAsync());
    }

    [Fact]
    public async Task A_suspended_game_loses_its_pin_2_hours_after_the_suspension_even_before_its_planned_end()
    {
        await using var server = ServerWithLeagueOfPlannedLength2AndAHalfHours();
        // Suspended 10 minutes in; the original schedule's window stays open for over 4 hours more.
        await SeeGameSuspendAsync(server, TimeSpan.FromMinutes(10));

        server.Clock.Advance(TimeSpan.FromHours(2));
        await using var client = await server.ConnectClientAsync();

        Assert.Empty(await client.NextSnapshotAsync());
    }
}
