using ScoreMap.Server.GameFeed;
using ScoreMap.Server.Games;
using ScoreMap.Server.Tests.Support;
using static ScoreMap.Server.GameFeed.ProviderStatus;

namespace ScoreMap.Server.Tests;

/// <summary>A NASCAR race as a connected client receives it: its field, its progress line and its pulses.</summary>
public class RacingTests
{
    private const string Nascar = "racing/nascar-premier";

    private static readonly ProviderVenue Talladega = new("Talladega Superspeedway", "Talladega", "AL", "USA", "15");

    private static ProviderEntrant Entrant(int position, string name) =>
        new(position, name, $"{name[0]}. {name.Split(' ')[^1]}", "https://a.espncdn.com/i/teamlogos/countries/500/usa.png");

    /// <summary>A NASCAR race at Talladega with its field in this order, the leader first.</summary>
    private static ProviderGame Race(ScoreMapServer server, ProviderStatus status, int? lap, params string[] order) => new(
        Id: "202610250041",
        LeagueKey: Nascar,
        StartTime: server.Clock.GetUtcNow().AddHours(-1),
        Contest: new ProviderField(order.Select((name, i) => Entrant(i + 1, name)).ToList()),
        Status: status,
        DisplayClock: null,
        Period: lap,
        Venue: Talladega)
    {
        Note = "NASCAR Cup Series at Talladega",
    };

    [Fact]
    public async Task A_live_race_has_its_field_in_order_and_its_progress_line_is_the_lap()
    {
        await using var server = new ScoreMapServer();
        server.Feed.SetScoreboard(Nascar, Race(server, InProgress, 189, "Kyle Larson", "William Byron", "Ryan Blaney"));
        await using var client = await server.ConnectClientAsync();

        var game = Assert.Single(await client.NextSnapshotAsync());

        Assert.Equal("Racing", game.Sport);
        Assert.Equal("NASCAR Cup Series", game.League);
        Assert.Equal("Lap 189", game.Clock);
        Assert.False(game.Hot);
        var field = Assert.IsType<GameField>(game.Contest);
        Assert.Equal(
            [new GameEntrant(1, "Kyle Larson", "K. Larson", "https://a.espncdn.com/i/teamlogos/countries/500/usa.png"),
             new GameEntrant(2, "William Byron", "W. Byron", "https://a.espncdn.com/i/teamlogos/countries/500/usa.png"),
             new GameEntrant(3, "Ryan Blaney", "R. Blaney", "https://a.espncdn.com/i/teamlogos/countries/500/usa.png")],
            field.Entries);
    }

    [Fact]
    public async Task A_finished_race_reads_Final_and_one_not_started_has_no_progress_line_or_field()
    {
        await using var server = new ScoreMapServer();
        server.Feed.SetScoreboard(Nascar,
            Race(server, Final, 189, "Kyle Larson", "William Byron"),
            Race(server, Scheduled, null) with { Id = "202611010020", StartTime = server.Clock.GetUtcNow().AddMinutes(20) });
        await using var client = await server.ConnectClientAsync();

        var games = await client.NextSnapshotAsync();

        Assert.Equal("Final", Assert.Single(games, g => g.Status == GameStatus.Final).Clock);
        var upcoming = Assert.Single(games, g => g.Status == GameStatus.Upcoming);
        Assert.Null(upcoming.Clock);
        Assert.Empty(Assert.IsType<GameField>(upcoming.Contest).Entries);
    }

    [Fact]
    public async Task The_lead_changing_hands_is_pushed_as_a_score_change()
    {
        await using var server = new ScoreMapServer();
        server.Feed.SetScoreboard(Nascar, Race(server, InProgress, 150, "Kyle Larson", "William Byron", "Ryan Blaney"));
        await using var client = await server.ConnectClientAsync();
        await client.NextSnapshotAsync();

        server.Feed.SetScoreboard(Nascar, Race(server, InProgress, 151, "William Byron", "Kyle Larson", "Ryan Blaney"));
        server.Clock.Advance(TimeSpan.FromSeconds(15));

        var change = await client.NextChangeAsync();
        Assert.Equal(GameChangeKind.ScoreChanged, change.Kind);
        Assert.Equal("William Byron", Assert.IsType<GameField>(change.Game.Contest).Entries[0].Name);
    }

    [Fact]
    public async Task A_change_in_order_behind_the_leader_is_pushed_as_an_update()
    {
        await using var server = new ScoreMapServer();
        server.Feed.SetScoreboard(Nascar, Race(server, InProgress, 150, "Kyle Larson", "William Byron", "Ryan Blaney"));
        await using var client = await server.ConnectClientAsync();
        await client.NextSnapshotAsync();

        server.Feed.SetScoreboard(Nascar, Race(server, InProgress, 150, "Kyle Larson", "Ryan Blaney", "William Byron"));
        server.Clock.Advance(TimeSpan.FromSeconds(15));

        var change = await client.NextChangeAsync();
        Assert.Equal(GameChangeKind.Updated, change.Kind);
        Assert.Equal("Ryan Blaney", Assert.IsType<GameField>(change.Game.Contest).Entries[1].Name);
    }

    [Fact]
    public async Task An_unchanged_race_pushes_nothing()
    {
        await using var server = new ScoreMapServer();
        server.Feed.SetScoreboard(Nascar, Race(server, InProgress, 150, "Kyle Larson", "William Byron"));
        await using var client = await server.ConnectClientAsync();
        await client.NextSnapshotAsync();

        // Poll once with the same field built afresh, then once with a change: the change must be the first event.
        server.Feed.SetScoreboard(Nascar, Race(server, InProgress, 150, "Kyle Larson", "William Byron"));
        server.Clock.Advance(TimeSpan.FromSeconds(15));
        await server.Feed.WaitForFetchesAsync(Nascar, 2);
        server.Feed.SetScoreboard(Nascar, Race(server, InProgress, 151, "Kyle Larson", "William Byron"));
        server.Clock.Advance(TimeSpan.FromSeconds(15));

        var change = await client.NextChangeAsync();
        Assert.Equal((GameChangeKind.Updated, 151), (change.Kind, change.Game.Period));
    }
}
