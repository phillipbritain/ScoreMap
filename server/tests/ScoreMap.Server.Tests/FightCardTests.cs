using ScoreMap.Server.GameFeed;
using ScoreMap.Server.Games;
using ScoreMap.Server.Tests.Support;
using static ScoreMap.Server.GameFeed.ProviderStatus;

namespace ScoreMap.Server.Tests;

/// <summary>A UFC fight card as a connected client receives it: its bouts, its progress line, when it's hot and its pulses.</summary>
public class FightCardTests
{
    private const string Ufc = "mma/ufc";

    private static readonly ProviderVenue MetaApex = new("Meta APEX", "Las Vegas", "NV", "USA", "6176");

    private static ProviderBoutSide Side(string name, bool winner = false) =>
        new(name, $"{name[0]}. {name.Split(' ')[^1]}", "https://a.espncdn.com/i/teamlogos/countries/500/usa.png", "10-2-0", winner);

    /// <summary>The main event, five rounds, in the given state.</summary>
    private static ProviderBout MainEvent(ProviderStatus status, int? round = null, BoutMethod? method = null, string? clock = null) =>
        new("main", Side("Renato Moicano"), Side("Tom Nolan", winner: method is not null), "Lightweight", 5, status, round, clock, method);

    /// <summary>The co-main event, three rounds, in the given state.</summary>
    private static ProviderBout CoMainEvent(ProviderStatus status, int? round = null, BoutMethod? method = null) =>
        new("co-main", Side("Randy Brown"), Side("Jacobe Smith", winner: method is not null), "Welterweight", 3, status, round,
            round is null ? null : "5:00", method);

    /// <summary>A fight card at the Meta APEX with these bouts, the main event first.</summary>
    private static ProviderGame Card(ScoreMapServer server, ProviderStatus status, params ProviderBout[] bouts) => new(
        Id: "600061420",
        LeagueKey: Ufc,
        StartTime: server.Clock.GetUtcNow().AddHours(-3),
        Contest: new ProviderBouts(bouts),
        Status: status,
        DisplayClock: null,
        Period: null,
        Venue: MetaApex,
        Broadcasters: [])
    {
        Note = "UFC Fight Night: Moicano vs. Nolan",
    };

    private static async Task<Game> OnlyGame(ProviderGame card)
    {
        await using var server = new ScoreMapServer();
        server.Feed.SetScoreboard(Ufc, card with { StartTime = server.Clock.GetUtcNow().AddHours(-3) });
        await using var client = await server.ConnectClientAsync();
        return Assert.Single(await client.NextSnapshotAsync());
    }

    private static ProviderGame CardWith(ProviderStatus status, params ProviderBout[] bouts) => new(
        "600061420", Ufc, DateTimeOffset.MinValue, new ProviderBouts(bouts), status, null, null, MetaApex, [])
    {
        Note = "UFC Fight Night: Moicano vs. Nolan",
    };

    [Fact]
    public async Task A_card_in_progress_has_its_bouts_main_event_first_and_its_progress_line_is_the_round_of_the_bout_on()
    {
        var game = await OnlyGame(CardWith(InProgress, MainEvent(Scheduled), CoMainEvent(InProgress, round: 2)));

        Assert.Equal(("MMA", "UFC", "R2", false), (game.Sport, game.League, game.Clock, game.Hot));
        var bouts = Assert.IsType<GameBouts>(game.Contest).Bouts;
        Assert.Equal(
            new GameBout("main",
                new GameBoutSide("Renato Moicano", "R. Moicano", "https://a.espncdn.com/i/teamlogos/countries/500/usa.png", "10-2-0", false),
                new GameBoutSide("Tom Nolan", "T. Nolan", "https://a.espncdn.com/i/teamlogos/countries/500/usa.png", "10-2-0", false),
                "Lightweight", 5, GameStatus.Upcoming, null, null, null),
            bouts[0]);
        Assert.Equal(("co-main", GameStatus.Live, 2), (bouts[1].Id, bouts[1].Status, bouts[1].Round));
    }

    [Fact]
    public async Task A_card_between_bouts_says_so()
    {
        var game = await OnlyGame(CardWith(InProgress, MainEvent(Scheduled), CoMainEvent(Final, round: 3, BoutMethod.Decision)));

        Assert.Equal("Between bouts", game.Clock);
    }

    [Fact]
    public async Task A_finished_card_shows_how_its_main_event_was_won()
    {
        var stoppage = await OnlyGame(CardWith(Final, MainEvent(Final, round: 3, BoutMethod.KnockOut, "1:28"), CoMainEvent(Final, 3, BoutMethod.Decision)));
        var decision = await OnlyGame(CardWith(Final, MainEvent(Final, round: 5, BoutMethod.Decision, "5:00"), CoMainEvent(Final, 3, BoutMethod.Decision)));
        var unsaid = await OnlyGame(CardWith(Final, MainEvent(Final, round: 5), CoMainEvent(Final, 3, BoutMethod.Decision)));

        Assert.Equal(("KO/TKO · R3", "Decision", "Final"), (stoppage.Clock, decision.Clock, unsaid.Clock));
        var main = Assert.IsType<GameBouts>(stoppage.Contest).Bouts[0];
        Assert.Equal((GameStatus.Final, 3, "1:28", "KO/TKO", true), (main.Status, main.Round, main.Clock, main.Method, main.Second.Winner));
    }

    [Fact]
    public async Task A_card_not_started_has_no_progress_line()
    {
        await using var server = new ScoreMapServer();
        server.Feed.SetScoreboard(Ufc, Card(server, Scheduled, MainEvent(Scheduled), CoMainEvent(Scheduled)) with
        {
            StartTime = server.Clock.GetUtcNow().AddMinutes(20),
        });
        await using var client = await server.ConnectClientAsync();

        var game = Assert.Single(await client.NextSnapshotAsync());

        Assert.Equal((GameStatus.Upcoming, null), (game.Status, game.Clock));
    }

    public static TheoryData<string, ProviderBout, ProviderBout, bool> Heat => new()
    {
        { "the main event in its last scheduled round", MainEvent(InProgress, round: 5), CoMainEvent(Final, 3, BoutMethod.Decision), true },
        { "the main event before its last round", MainEvent(InProgress, round: 4), CoMainEvent(Final, 3, BoutMethod.Decision), false },
        { "another bout in its last round", MainEvent(Scheduled), CoMainEvent(InProgress, round: 3), false },
    };

    [Theory]
    [MemberData(nameof(Heat))]
    public async Task A_card_is_hot_only_while_its_main_event_is_in_its_last_scheduled_round(
        string when, ProviderBout main, ProviderBout coMain, bool hot)
    {
        var game = await OnlyGame(CardWith(InProgress, main, coMain));

        Assert.True(game.Hot == hot, $"With {when}, hot should be {hot}");
    }

    [Fact]
    public async Task A_bout_finishing_is_pushed_as_a_score_change()
    {
        await using var server = new ScoreMapServer();
        server.Feed.SetScoreboard(Ufc, Card(server, InProgress, MainEvent(Scheduled), CoMainEvent(InProgress, round: 3)));
        await using var client = await server.ConnectClientAsync();
        await client.NextSnapshotAsync();

        server.Feed.SetScoreboard(Ufc, Card(server, InProgress, MainEvent(Scheduled), CoMainEvent(Final, round: 3, BoutMethod.Decision)));
        server.Clock.Advance(TimeSpan.FromSeconds(15));

        var change = await client.NextChangeAsync();
        Assert.Equal(GameChangeKind.ScoreChanged, change.Kind);
        Assert.Equal("Decision", Assert.IsType<GameBouts>(change.Game.Contest).Bouts[1].Method);
    }

    [Fact]
    public async Task A_new_round_is_pushed_as_an_update_and_an_unchanged_card_pushes_nothing()
    {
        await using var server = new ScoreMapServer();
        server.Feed.SetScoreboard(Ufc, Card(server, InProgress, MainEvent(InProgress, round: 1), CoMainEvent(Final, 3, BoutMethod.Decision)));
        await using var client = await server.ConnectClientAsync();
        await client.NextSnapshotAsync();

        // Poll once with the same card built afresh, then once with a new round: the round must be the first event.
        server.Feed.SetScoreboard(Ufc, Card(server, InProgress, MainEvent(InProgress, round: 1), CoMainEvent(Final, 3, BoutMethod.Decision)));
        server.Clock.Advance(TimeSpan.FromSeconds(15));
        await server.Feed.WaitForFetchesAsync(Ufc, 2);
        server.Feed.SetScoreboard(Ufc, Card(server, InProgress, MainEvent(InProgress, round: 2), CoMainEvent(Final, 3, BoutMethod.Decision)));
        server.Clock.Advance(TimeSpan.FromSeconds(15));

        var change = await client.NextChangeAsync();
        Assert.Equal((GameChangeKind.Updated, "R2"), (change.Kind, change.Game.Clock));
    }
}
