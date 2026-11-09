using ScoreMap.Server.GameFeed;
using ScoreMap.Server.Games;
using ScoreMap.Server.Tests.Support;
using static ScoreMap.Server.Tests.Support.ProviderGames;

namespace ScoreMap.Server.Tests;

public class PinWindowTests
{
    [Fact]
    public async Task An_Upcoming_game_has_no_pin_earlier_than_30_minutes_before_its_start()
    {
        await using var server = new ScoreMapServer();
        var start = server.Clock.GetUtcNow().AddMinutes(31);
        server.Feed.SetScoreboard("football/nfl", NflGame(start, ProviderStatus.Scheduled));

        await using var client = await server.ConnectClientAsync();

        Assert.Empty(await client.NextSnapshotAsync());
    }

    [Fact]
    public async Task An_Upcoming_game_gets_its_pin_from_30_minutes_before_its_start()
    {
        await using var server = new ScoreMapServer();
        var start = server.Clock.GetUtcNow().AddMinutes(30);
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

        server.Clock.Advance(TimeSpan.FromMinutes(3));
        await using var client = await server.ConnectClientAsync();
        var game = Assert.Single(await client.NextSnapshotAsync());

        Assert.Equal(end, game.EndTime);
    }

    [Fact]
    public async Task A_game_seen_to_finish_is_sent_Final_before_it_loses_its_pin()
    {
        await using var server = new ScoreMapServer();
        var start = server.Clock.GetUtcNow().AddHours(-3);
        server.Feed.SetScoreboard("football/nfl", NflGame(start, ProviderStatus.InProgress));
        await using var client = await server.ConnectClientAsync();
        Assert.Single(await client.NextSnapshotAsync());

        server.Feed.SetScoreboard("football/nfl", NflGame(start, ProviderStatus.Final));
        server.Clock.Advance(TimeSpan.FromMinutes(1));

        var change = await client.NextChangeAsync();
        Assert.Equal(GameStatus.Final, change.Game.Status);
    }

    [Fact]
    public async Task A_Live_game_suspended_loses_its_pin_at_once()
    {
        await using var server = new ScoreMapServer();
        var start = server.Clock.GetUtcNow().AddHours(-1);
        server.Feed.SetScoreboard("football/nfl", NflGame(start, ProviderStatus.InProgress));
        await using var client = await server.ConnectClientAsync();
        Assert.Single(await client.NextSnapshotAsync());

        server.Feed.SetScoreboard("football/nfl", NflGame(start, ProviderStatus.Suspended));
        server.Clock.Advance(TimeSpan.FromMinutes(1));

        var change = await client.NextChangeAsync();
        Assert.Equal(GameChangeKind.Removed, change.Kind);
    }

    [Fact]
    public async Task A_Final_game_keeps_its_pin_until_5_minutes_after_it_ends()
    {
        await using var server = new ScoreMapServer();
        await SeeGameFinishAsync(server);

        server.Clock.Advance(TimeSpan.FromMinutes(5) - TimeSpan.FromSeconds(1));
        await using var client = await server.ConnectClientAsync();

        Assert.Single(await client.NextSnapshotAsync());
    }

    [Fact]
    public async Task A_Final_game_loses_its_pin_5_minutes_after_it_ends()
    {
        await using var server = new ScoreMapServer();
        await SeeGameFinishAsync(server);

        server.Clock.Advance(TimeSpan.FromMinutes(5));
        await using var client = await server.ConnectClientAsync();

        Assert.Empty(await client.NextSnapshotAsync());
    }

    // A league whose games are planned to last 2½ hours, so a game starting at T is planned to end at T + 2½ h.
    private static ScoreMapServer ServerWithLeagueOfPlannedLength2AndAHalfHours()
    {
        var server = new ScoreMapServer();
        server.AddLeague("test/league", "Test League", "Soccer", TimeSpan.FromMinutes(150));
        return server;
    }

    private static ProviderGame TestLeagueGame(DateTimeOffset start, ProviderStatus status) =>
        TestGames.Game("t1", "test/league", start, status, null, null, null, null);

    // A game already Final the first time the server sees it (e.g. after the server slept) didn't end then:
    // its end is estimated as its planned end, or now if that is still to come.
    [Fact]
    public async Task A_game_already_Final_when_first_seen_is_estimated_to_have_ended_at_its_planned_end()
    {
        await using var server = ServerWithLeagueOfPlannedLength2AndAHalfHours();
        var start = server.Clock.GetUtcNow() - TimeSpan.FromMinutes(150 + 2);
        server.Feed.SetScoreboard("test/league", TestLeagueGame(start, ProviderStatus.Final));

        await using var client = await server.ConnectClientAsync();
        var game = Assert.Single(await client.NextSnapshotAsync());

        Assert.Equal(start + TimeSpan.FromMinutes(150), game.EndTime);
    }

    [Fact]
    public async Task A_game_already_Final_when_first_seen_before_its_planned_end_is_taken_to_have_just_ended()
    {
        await using var server = ServerWithLeagueOfPlannedLength2AndAHalfHours();
        var start = server.Clock.GetUtcNow() - TimeSpan.FromHours(2);
        server.Feed.SetScoreboard("test/league", TestLeagueGame(start, ProviderStatus.Final));

        await using var client = await server.ConnectClientAsync();
        var game = Assert.Single(await client.NextSnapshotAsync());

        Assert.Equal(server.Clock.GetUtcNow(), game.EndTime);
    }

    [Fact]
    public async Task A_game_already_Final_when_first_seen_keeps_its_pin_until_5_minutes_after_its_planned_end()
    {
        await using var server = ServerWithLeagueOfPlannedLength2AndAHalfHours();
        var start = server.Clock.GetUtcNow() - TimeSpan.FromMinutes(150 + 4);
        server.Feed.SetScoreboard("test/league", TestLeagueGame(start, ProviderStatus.Final));

        await using var client = await server.ConnectClientAsync();

        Assert.Single(await client.NextSnapshotAsync());
    }

    [Fact]
    public async Task A_game_already_Final_when_first_seen_has_no_pin_5_minutes_after_its_planned_end()
    {
        await using var server = ServerWithLeagueOfPlannedLength2AndAHalfHours();
        var start = server.Clock.GetUtcNow() - TimeSpan.FromMinutes(150 + 5);
        server.Feed.SetScoreboard("test/league", TestLeagueGame(start, ProviderStatus.Final));

        await using var client = await server.ConnectClientAsync();

        Assert.Empty(await client.NextSnapshotAsync());
    }
}
