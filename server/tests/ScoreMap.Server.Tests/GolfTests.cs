using ScoreMap.Server.GameFeed;
using ScoreMap.Server.Games;
using ScoreMap.Server.Tests.Support;
using static ScoreMap.Server.GameFeed.ProviderStatus;

namespace ScoreMap.Server.Tests;

/// <summary>
/// A PGA Tour tournament as a connected client receives it: its field with scores to par and ties, its
/// progress line, its pulses and when it's hot (ADR-0020).
/// </summary>
public class GolfTests
{
    private const string Pga = "golf/pga";

    private static readonly ProviderVenue Vidanta = new("Vidanta Vallarta", "Nuevo Vallarta", null, "Mexico", "11163");

    /// <summary>A golfer at this score to par, having played this many holes of the round.</summary>
    private static ProviderEntrant Golfer(string name, int toPar, int thru = 18) =>
        new(0, name, $"{name[0]}. {name.Split(' ')[^1]}", "https://a.espncdn.com/i/teamlogos/countries/500/usa.png", toPar, thru);

    /// <summary>The Mexico Open in this round, its field in this order, the leader first, ties sharing a position.</summary>
    private static ProviderGame Tournament(ScoreMapServer server, ProviderStatus status, int? round, params ProviderEntrant[] order) =>
        new(
            Id: "401850978",
            LeagueKey: Pga,
            StartTime: server.Clock.GetUtcNow().AddDays(-1),
            Contest: ProviderField.TiedByScore(order),
            Status: status,
            DisplayClock: null,
            Period: round,
            Venue: Vidanta)
        {
            Note = "VidantaWorld Mexico Open",
        };

    private static async Task<Game> SentAsync(Func<ScoreMapServer, ProviderGame> tournament)
    {
        await using var server = new ScoreMapServer();
        server.Feed.SetScoreboard(Pga, tournament(server));
        await using var client = await server.ConnectClientAsync();
        return Assert.Single(await client.NextSnapshotAsync());
    }

    [Fact]
    public async Task A_live_tournament_has_its_field_with_scores_to_par_ties_sharing_a_position()
    {
        var game = await SentAsync(server => Tournament(server, InProgress, 2,
            Golfer("Ben Griffin", -12, thru: 14), Golfer("Kihei Akina", -11), Golfer("Matthieu Pavon", -11),
            Golfer("Ryan Gerard", 0), Golfer("Aaron Rai", 3)));

        Assert.Equal("Golf", game.Sport);
        Assert.Equal("PGA Tour", game.League);
        var field = Assert.IsType<GameField>(game.Contest);
        Assert.Equal(
            [(1, "Ben Griffin", "-12"), (2, "Kihei Akina", "-11"), (2, "Matthieu Pavon", "-11"), (4, "Ryan Gerard", "E"), (5, "Aaron Rai", "+3")],
            field.Entries.Select(entrant => (entrant.Position, entrant.Name, entrant.Score)));
    }

    [Fact]
    public async Task A_round_under_way_reads_the_round_and_the_leaders_holes() =>
        Assert.Equal("R2 · Thru 14",
            (await SentAsync(server => Tournament(server, InProgress, 2, Golfer("Ben Griffin", -12, thru: 14), Golfer("Kihei Akina", -11)))).Clock);

    [Fact]
    public async Task Between_rounds_it_reads_after_the_round_just_played() =>
        Assert.Equal("After R2",
            (await SentAsync(server => Tournament(server, InProgress, 2, Golfer("Ben Griffin", -12), Golfer("Kihei Akina", -11))
                with { Phase = ProviderPeriodPhase.Break })).Clock);

    [Fact]
    public async Task A_finished_tournament_reads_Final() =>
        Assert.Equal("Final",
            (await SentAsync(server => Tournament(server, Final, 4, Golfer("Ben Griffin", -20), Golfer("Kihei Akina", -18)))).Clock);

    [Theory]
    [InlineData(4, 9, -15, -14, true)]
    [InlineData(4, 18, -15, -15, true)]
    [InlineData(4, 8, -15, -14, false)]
    [InlineData(4, 12, -15, -13, false)]
    [InlineData(3, 12, -15, -14, false)]
    public async Task Hot_in_the_final_round_once_the_leader_has_played_9_holes_leading_by_no_more_than_1_shot(
        int round, int leaderThru, int leader, int second, bool expected) =>
        Assert.Equal(expected, (await SentAsync(server => Tournament(server, InProgress, round,
            Golfer("Ben Griffin", leader, leaderThru), Golfer("Kihei Akina", second), Golfer("Aaron Rai", second + 3)))).Hot);

    [Fact]
    public async Task Not_hot_between_rounds() =>
        Assert.False((await SentAsync(server => Tournament(server, InProgress, 4, Golfer("Ben Griffin", -15), Golfer("Kihei Akina", -14))
            with { Phase = ProviderPeriodPhase.Break })).Hot);

    [Fact]
    public async Task The_lead_changing_hands_is_a_score_change_but_a_tie_for_the_lead_is_not_until_someone_leads_alone()
    {
        await using var server = new ScoreMapServer();
        server.Feed.SetScoreboard(Pga, Tournament(server, InProgress, 4, Golfer("Ben Griffin", -15, 10), Golfer("Kihei Akina", -14)));
        await using var client = await server.ConnectClientAsync();
        await client.NextSnapshotAsync();

        server.Feed.SetScoreboard(Pga, Tournament(server, InProgress, 4, Golfer("Kihei Akina", -15), Golfer("Ben Griffin", -15, 11)));
        server.Clock.Advance(TimeSpan.FromSeconds(15));
        var tied = await client.NextChangeAsync();
        server.Feed.SetScoreboard(Pga, Tournament(server, InProgress, 4, Golfer("Kihei Akina", -16), Golfer("Ben Griffin", -15, 12)));
        server.Clock.Advance(TimeSpan.FromSeconds(15));
        var overtaken = await client.NextChangeAsync();

        Assert.Equal(GameChangeKind.Updated, tied.Kind);
        Assert.Equal(GameChangeKind.ScoreChanged, overtaken.Kind);
        Assert.Equal("Kihei Akina", Assert.IsType<GameField>(overtaken.Game.Contest).Entries[0].Name);
    }
}
