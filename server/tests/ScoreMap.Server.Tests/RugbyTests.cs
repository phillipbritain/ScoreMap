using ScoreMap.Server.GameFeed;
using ScoreMap.Server.Games;
using ScoreMap.Server.Tests.Support;
using static ScoreMap.Server.GameFeed.ProviderPeriodPhase;
using static ScoreMap.Server.GameFeed.ProviderStatus;

namespace ScoreMap.Server.Tests;

/// <summary>A Six Nations match as a connected client receives it: its scores, progress line, last score, key events and whether it's hot.</summary>
public class RugbyTests
{
    private const string SixNations = "rugby/180659";

    /// <summary>Ireland (home) against Scotland at the Aviva Stadium.</summary>
    private static ProviderGame Match(ProviderStatus status, int? period, string? clock, int? home, int? away,
        ProviderPeriodPhase phase = Playing) => new(
        Id: "602514",
        LeagueKey: SixNations,
        StartTime: DateTimeOffset.UnixEpoch,
        Contest: new ProviderSides(
            new ProviderTeam("IRE", "Ireland", null, home),
            new ProviderTeam("SCO", "Scotland", null, away)),
        Status: status,
        DisplayClock: clock,
        Period: period,
        Venue: new ProviderVenue("Aviva Stadium", "Dublin", "Ireland", null),
        Broadcasters: [],
        Phase: phase);

    /// <summary>The game as a connected client is sent it, the feed reporting <paramref name="match"/>.</summary>
    private static async Task<Game> SentAsync(ProviderGame match)
    {
        await using var server = new ScoreMapServer();
        server.Feed.SetScoreboard(SixNations, match with { StartTime = server.Clock.GetUtcNow().AddHours(-1) });
        await using var client = await server.ConnectClientAsync();
        return Assert.Single(await client.NextSnapshotAsync());
    }

    [Fact]
    public async Task A_live_match_scores_points_and_its_progress_line_shows_the_minute()
    {
        var game = await SentAsync(Match(InProgress, 2, "57'", 31, 21));

        Assert.Equal(("Six Nations", "Rugby", GameStatus.Live), (game.League, game.Sport, game.Status));
        Assert.Equal(("31", "21"), (game.Sides().Home.Score, game.Sides().Away.Score));
        Assert.Equal("57'", game.Clock);
    }

    [Theory]
    [InlineData(1, Break, "HT")]
    [InlineData(1, Playing, "12'")]
    public async Task The_progress_line_reads_half_time_on_the_break(int period, ProviderPeriodPhase phase, string expected) =>
        Assert.Equal(expected, (await SentAsync(Match(InProgress, period, "12'", 7, 3, phase))).Clock);

    [Fact]
    public async Task A_finished_match_reads_full_time()
    {
        await using var server = new ScoreMapServer();
        server.Feed.SetScoreboard(SixNations, Match(Final, 2, "81'", 43, 21) with { StartTime = server.Clock.GetUtcNow().AddHours(-2) });
        await using var client = await server.ConnectClientAsync();

        Assert.Equal("FT", Assert.Single(await client.NextSnapshotAsync()).Clock);
    }

    [Fact]
    public async Task Its_last_score_is_told_at_its_minute_and_its_scores_and_cards_are_listed()
    {
        var game = await SentAsync(Match(InProgress, 2, "62'", 26, 21) with
        {
            KeyEvents =
            [
                new ProviderKeyEvent(KeyEventKind.YellowCard, "SCO", "Rory Darge", "58'"),
                new ProviderKeyEvent(KeyEventKind.Try, "SCO", "Rory Darge", "61'"),
                new ProviderKeyEvent(KeyEventKind.Conversion, "SCO", "Finn Russell", "62'"),
            ],
            LastScore = new ProviderScoringPlay("SCO", "Conversion: Finn Russell", null, "62'"),
        });

        Assert.Equal(new ScoringPlay("SCO", "Conversion: Finn Russell", "62'"), game.LastScore);
        Assert.Equal([KeyEventKind.YellowCard, KeyEventKind.Try, KeyEventKind.Conversion], game.KeyEvents.Select(k => k.Kind));
    }

    [Theory]
    [InlineData(2, "75'", 20, 13, true)]
    [InlineData(2, "79'", 20, 20, true)]
    [InlineData(2, "84'", 17, 20, true)]
    [InlineData(2, "74'", 20, 13, false)]
    [InlineData(2, "78'", 21, 13, false)]
    [InlineData(1, "39'", 3, 3, false)]
    [InlineData(3, "85'", 23, 16, true)]
    [InlineData(3, "85'", 24, 16, false)]
    public async Task A_match_is_hot_from_the_75th_minute_or_in_extra_time_within_a_converted_try(
        int period, string clock, int home, int away, bool expected) =>
        Assert.Equal(expected, (await SentAsync(Match(InProgress, period, clock, home, away))).Hot);

    [Fact]
    public async Task A_match_at_half_time_is_not_hot() =>
        Assert.False((await SentAsync(Match(InProgress, 1, "40'", 10, 10, Break))).Hot);
}
