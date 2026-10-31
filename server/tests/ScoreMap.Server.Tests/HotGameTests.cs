using ScoreMap.Server.GameFeed;
using ScoreMap.Server.Games;
using ScoreMap.Server.Tests.Support;
using static ScoreMap.Server.GameFeed.ProviderPeriodPhase;
using static ScoreMap.Server.GameFeed.ProviderStatus;

namespace ScoreMap.Server.Tests;

/// <summary>
/// Whether a connected client is told a game is hot (see GLOSSARY.md): Live, the trailing side one score
/// from tying or taking the lead, and little left to play, by each sport's own rule.
/// </summary>
public class HotGameTests
{
    private const string Nfl = "football/nfl";
    private const string Nba = "basketball/nba";
    private const string Mlb = "baseball/mlb";
    private const string Nhl = "hockey/nhl";
    private const string Mls = "soccer/usa.1";
    private const string Ipl = "cricket/8048";

    [Theory]
    [InlineData(4, "4:00", 21, 13, true)]
    [InlineData(4, "0:12", 20, 21, true)]
    [InlineData(4, "4:01", 21, 21, false)]
    [InlineData(4, "2:00", 22, 13, false)]
    [InlineData(3, "1:00", 21, 20, false)]
    [InlineData(5, "9:30", 27, 27, true)]
    [InlineData(5, "1:00", 30, 27, true)]
    public async Task Football_in_the_last_4_minutes_of_the_4th_quarter_or_overtime_within_8_points(
        int period, string clock, int home, int away, bool expected) =>
        Assert.Equal(expected, (await SentAsync(Game(Nfl, clock, period, home, away))).Hot);

    [Theory]
    [InlineData(3, "5:00", 2, 1, true)]
    [InlineData(3, "0:40", 3, 3, true)]
    [InlineData(3, "5:01", 2, 2, false)]
    [InlineData(3, "1:00", 4, 2, false)]
    [InlineData(2, "1:00", 1, 1, false)]
    [InlineData(4, "4:30", 3, 3, true)]
    public async Task Hockey_in_the_last_5_minutes_of_the_3rd_period_within_1_goal_or_overtime(
        int period, string clock, int home, int away, bool expected) =>
        Assert.Equal(expected, (await SentAsync(Game(Nhl, clock, period, home, away))).Hot);

    [Fact]
    public async Task Hockey_in_a_shootout() =>
        Assert.True((await SentAsync(Game(Nhl, "0:00", 5, 2, 2, Shootout))).Hot);

    [Theory]
    [InlineData(2, "85'", 1, 0, true)]
    [InlineData(2, "90'+4'", 2, 2, true)]
    [InlineData(2, "84'", 1, 0, false)]
    [InlineData(2, "88'", 2, 0, false)]
    [InlineData(1, "45'+2'", 0, 0, false)]
    [InlineData(4, "115'", 1, 1, true)]
    [InlineData(4, "120'+2'", 2, 1, true)]
    [InlineData(4, "114'", 1, 1, false)]
    [InlineData(3, "100'", 1, 1, false)]
    [InlineData(4, "118'", 3, 1, false)]
    public async Task Soccer_from_the_85th_minute_or_the_115th_of_extra_time_within_1_goal(
        int period, string clock, int home, int away, bool expected) =>
        Assert.Equal(expected, (await SentAsync(Game(Mls, clock, period, home, away))).Hot);

    [Fact]
    public async Task Soccer_in_a_penalty_shootout() =>
        Assert.True((await SentAsync(Game(Mls, null, 5, 1, 1, Shootout))).Hot);

    [Theory]
    [InlineData(InningBottom, 3, 3, 0, true)]
    [InlineData(InningBottom, 2, 3, 0, true)]
    [InlineData(InningBottom, 1, 3, 0, false)]
    [InlineData(InningBottom, 1, 3, 1, true)]
    [InlineData(InningBottom, 1, 4, 2, true)]
    [InlineData(InningBottom, 1, 5, 2, false)]
    [InlineData(InningBottom, 1, 5, 3, true)]
    [InlineData(InningTop, 4, 3, 0, true)]
    [InlineData(InningTop, 3, 4, 0, false)]
    public async Task Baseball_from_the_9th_while_the_tying_run_is_on_base_or_at_the_plate(
        ProviderPeriodPhase half, int home, int away, int runners, bool expected) =>
        Assert.Equal(expected, (await SentAsync(Baseball(9, half, home, away, runners))).Hot);

    [Fact]
    public async Task Baseball_in_extra_innings() =>
        Assert.True((await SentAsync(Baseball(11, InningTop, 5, 4, runners: 0))).Hot);

    [Theory]
    [InlineData(8, InningBottom)]
    [InlineData(9, InningMiddle)]
    [InlineData(9, InningEnd)]
    public async Task Not_in_baseball_before_the_9th_or_between_half_innings(int inning, ProviderPeriodPhase half) =>
        Assert.False((await SentAsync(Baseball(inning, half, 3, 3, runners: 0))).Hot);

    [Theory]
    [InlineData("18", 150, 174, true)]
    [InlineData("18.4", 160, 176, true)]
    [InlineData("17.5", 160, 165, false)]
    [InlineData("18", 150, 175, false)]
    [InlineData("19.5", 170, 171, true)]
    public async Task Cricket_in_the_last_2_overs_of_a_chase_needing_no_more_than_2_a_ball(
        string overs, int runs, int target, bool expected) =>
        Assert.Equal(expected, (await SentAsync(Chase(overs, runs, target, wickets: 5, overLimit: 20))).Hot);

    [Fact]
    public async Task Not_in_cricket_once_the_chasing_side_has_no_wickets_left() =>
        Assert.False((await SentAsync(Chase("19", 160, 165, wickets: null, overLimit: 20))).Hot);

    [Fact]
    public async Task Not_in_cricket_once_the_chase_needs_no_more_runs() =>
        Assert.False((await SentAsync(Chase("19", 165, 165, wickets: 5, overLimit: 20))).Hot);

    [Fact]
    public async Task Never_in_cricket_without_an_over_limit() =>
        Assert.False((await SentAsync(Chase("88", 250, 255, wickets: 8, overLimit: null))).Hot);

    [Theory]
    [InlineData("4:59", 100, 96, true)]
    [InlineData("5:01", 100, 96, false)]
    [InlineData("1:00", 100, 94, false)]
    public async Task Basketball_is_hot_exactly_in_clutch_time(string clock, int home, int away, bool expected)
    {
        var sent = await SentAsync(Game(Nba, clock, 4, home, away));

        Assert.Equal((expected, expected), (sent.Hot, sent.ClutchTime));
    }

    [Theory]
    [InlineData(Final)]
    [InlineData(Suspended)]
    public async Task Never_once_the_game_is_not_live(ProviderStatus status) =>
        Assert.False((await SentAsync(Game(Nfl, "0:00", 4, 21, 20) with { Status = status })).Hot);

    [Fact]
    public async Task A_game_that_stops_being_hot_is_sent_as_not_hot()
    {
        await using var server = new ScoreMapServer();
        var hot = Game(Nfl, "2:00", 4, 21, 20) with { StartTime = server.Clock.GetUtcNow().AddHours(-3) };
        server.Feed.SetScoreboard(Nfl, hot);
        await using var client = await server.ConnectClientAsync();
        Assert.True(Assert.Single(await client.NextSnapshotAsync()).Hot);

        server.Feed.SetScoreboard(Nfl, hot.WithSides(home: hot.Sides().Home with { Score = 30 }) with { DisplayClock = "1:50" });
        server.Clock.Advance(TimeSpan.FromSeconds(15));

        var change = await client.NextChangeAsync();
        Assert.Equal((GameChangeKind.ScoreChanged, false), (change.Kind, change.Game.Hot));
    }

    private static ProviderGame Game(
        string leagueKey, string? clock, int period, int home, int away, ProviderPeriodPhase phase = Playing) => new(
        Id: "1",
        LeagueKey: leagueKey,
        StartTime: DateTimeOffset.UnixEpoch,
        Contest: new ProviderSides(
            new ProviderTeam("HOM", "Home Team", null, home),
            new ProviderTeam("AWY", "Away Team", null, away)),
        Status: InProgress,
        DisplayClock: clock,
        Period: period,
        Venue: new ProviderVenue("Arena", "City", null, "Country"),
        Broadcasters: [],
        Phase: phase);

    private static ProviderGame Baseball(int inning, ProviderPeriodPhase half, int home, int away, int runners) =>
        Game(Mlb, null, inning, home, away, half) with
        {
            Situation = new ProviderSituation(null, Outs: 1, OnFirst: runners >= 1, OnSecond: runners >= 2, OnThird: runners >= 3),
        };

    /// <summary>The home side chasing <paramref name="target"/>, with <paramref name="overs"/> bowled to it.</summary>
    private static ProviderGame Chase(string overs, int runs, int target, int? wickets, int? overLimit) =>
        Game(Ipl, overs, 2, runs, target - 1) with
        {
            Contest = new ProviderSides(
                new ProviderTeam("HOM", "Home Team", null, runs, Innings: new ProviderInnings(wickets, overs, overLimit, target)),
                new ProviderTeam("AWY", "Away Team", null, target - 1, Innings: new ProviderInnings(7))),
        };

    /// <summary>The game as a connected client is sent it, the feed reporting <paramref name="game"/>.</summary>
    private static async Task<Game> SentAsync(ProviderGame game)
    {
        await using var server = new ScoreMapServer();
        server.Feed.SetScoreboard(game.LeagueKey, game with { StartTime = server.Clock.GetUtcNow().AddHours(-2) });
        await using var client = await server.ConnectClientAsync();
        return Assert.Single(await client.NextSnapshotAsync());
    }
}
