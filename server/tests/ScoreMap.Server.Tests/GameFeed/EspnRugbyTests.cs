using System.Text.Json.Nodes;
using Microsoft.Extensions.Time.Testing;
using ScoreMap.Server.GameFeed;
using ScoreMap.Server.Tests.Support;

namespace ScoreMap.Server.Tests.GameFeed;

/// <summary>
/// Runs a saved real ESPN Six Nations scoreboard (the last round of 2026, every match at full time) through the
/// adapter: one game per match between two sides, its scoring and cards from the scoreboard's details.
/// </summary>
public class EspnRugbyTests
{
    private const string SixNations = "rugby/180659";

    private static string Fixture(string name) =>
        File.ReadAllText(Path.Combine(AppContext.BaseDirectory, "Fixtures", "Espn", name));

    /// <summary>The games on <paramref name="scoreboard"/>; any other request (a summary, a team) fails the test.</summary>
    private static async Task<IReadOnlyList<ProviderGame>> FetchAsync(string scoreboard)
    {
        var handler = new StubHttpHandler(request => request.RequestUri!.AbsolutePath.Contains("/scoreboard")
            ? scoreboard
            : throw new InvalidOperationException($"Asked for {request.RequestUri}"));
        var provider = new EspnGameFeedProvider(
            new HttpClient(handler) { BaseAddress = new Uri("https://espn.test/sports/") },
            new FakeTimeProvider(new DateTimeOffset(2026, 3, 14, 22, 30, 0, TimeSpan.Zero)));
        return await provider.FetchScoreboardAsync(SixNations, CancellationToken.None);
    }

    /// <summary>
    /// <c>rugby-six-nations.json</c> with Ireland v Scotland under way, its status set to <paramref name="status"/>:
    /// a match in progress, which the saved response (from after the last round) doesn't have.
    /// </summary>
    private static string IrelandScotlandUnderWay(string status)
    {
        var scoreboard = JsonNode.Parse(Fixture("rugby-six-nations.json"))!;
        var e = scoreboard["events"]!.AsArray().Single(e => (string?)e!["id"] == "602514")!;
        e["status"] = JsonNode.Parse(status);
        e["competitions"]![0]!["status"] = JsonNode.Parse(status);
        return scoreboard.ToJsonString();
    }

    [Fact]
    public async Task A_match_at_full_time_is_a_final_game_between_two_sides_after_two_halves_at_its_venue()
    {
        var games = await FetchAsync(Fixture("rugby-six-nations.json"));

        Assert.Equal(["602514", "602515", "602516"], games.Select(g => g.Id));
        var game = games[0];
        Assert.Equal((ProviderStatus.Final, 2), (game.Status, game.Period));
        Assert.Equal(("IRE", "Ireland", 43), (game.Sides().Home.Abbreviation, game.Sides().Home.FullName, game.Sides().Home.Score));
        Assert.Equal(("SCO", "Scotland", 21), (game.Sides().Away.Abbreviation, game.Sides().Away.FullName, game.Sides().Away.Score));
        Assert.Equal("https://a.espncdn.com/i/teamlogos/rugby/teams/500/3.png", game.Sides().Home.LogoUrl);
        Assert.Equal(("Aviva Stadium", "Dublin", "Ireland"), (game.Venue?.Name, game.Venue?.City, game.Venue?.Region));
    }

    [Fact]
    public async Task A_sides_form_is_not_taken_for_its_record()
    {
        // ESPN gives a rugby side's last five results ("LWWWW") where other sports give a record.
        var game = (await FetchAsync(Fixture("rugby-six-nations.json")))[0];

        Assert.Equal((null, null), (game.Sides().Home.Record, game.Sides().Away.Record));
    }

    [Fact]
    public async Task A_match_carries_its_scores_and_cards_in_order_and_its_last_score_with_no_summary_request()
    {
        var game = (await FetchAsync(Fixture("rugby-six-nations.json")))[1];

        Assert.Equal([
            new ProviderKeyEvent(KeyEventKind.Try, "WAL", "Aaron Wainwright", "15'"),
            new ProviderKeyEvent(KeyEventKind.Conversion, "WAL", "Dan Edwards", "16'"),
            new ProviderKeyEvent(KeyEventKind.Try, "WAL", "Aaron Wainwright", "25'"),
            new ProviderKeyEvent(KeyEventKind.Conversion, "WAL", "Dan Edwards", "26'"),
            new ProviderKeyEvent(KeyEventKind.Try, "WAL", "Dewi Lake", "29'"),
            new ProviderKeyEvent(KeyEventKind.Conversion, "WAL", "Dan Edwards", "30'"),
            new ProviderKeyEvent(KeyEventKind.Try, "WAL", "Dan Edwards", "44'"),
            new ProviderKeyEvent(KeyEventKind.Conversion, "WAL", "Dan Edwards", "45'"),
            new ProviderKeyEvent(KeyEventKind.DropGoal, "WAL", "Dan Edwards", "48'"),
            new ProviderKeyEvent(KeyEventKind.YellowCard, "WAL", "Archie Griffin", "52'"),
            new ProviderKeyEvent(KeyEventKind.Try, "ITA", "Tommaso Di Bartolomeo", "52'"),
            new ProviderKeyEvent(KeyEventKind.Conversion, "ITA", "Paolo Garbisi", "53'"),
            new ProviderKeyEvent(KeyEventKind.Try, "ITA", "Tommaso Allan", "69'"),
            new ProviderKeyEvent(KeyEventKind.Try, "ITA", "Paolo Garbisi", "81'"),
        ], game.KeyEvents);
        Assert.Equal(new ProviderScoringPlay("ITA", "Try: Paolo Garbisi", null, "81'"), game.LastScore);
    }

    [Fact]
    public async Task A_penalty_goal_and_a_conversion_are_last_scores_too()
    {
        var games = await FetchAsync(Fixture("rugby-six-nations.json"));

        Assert.Equal(new ProviderScoringPlay("IRE", "Conversion: Jack Crowley", null, "81'"), games[0].LastScore);
        Assert.Equal(new ProviderScoringPlay("FRA", "Penalty goal: Thomas Ramos", null, "83'"), games[2].LastScore);
    }

    [Fact]
    public async Task Substitutions_are_not_key_events()
    {
        var game = (await FetchAsync(Fixture("rugby-six-nations.json")))[0];

        Assert.DoesNotContain(game.KeyEvents, k => k.Player is "George Turner" or "Ewan Ashman");
        Assert.Equal(18, game.KeyEvents.Count);
    }

    [Fact]
    public async Task A_match_in_progress_is_live_with_its_half_and_minute()
    {
        var games = await FetchAsync(IrelandScotlandUnderWay("""
            { "clock": 3420.0, "displayClock": "57'", "period": 2,
              "type": { "id": "23", "name": "STATUS_SECOND_HALF", "state": "in", "completed": false, "description": "Second Half", "detail": "57'", "shortDetail": "57'" } }
            """));

        var game = games[0];
        Assert.Equal((ProviderStatus.InProgress, 2, "57'", ProviderPeriodPhase.Playing), (game.Status, game.Period, game.DisplayClock, game.Phase));
        Assert.Equal((43, 21), (game.Sides().Home.Score, game.Sides().Away.Score));
    }

    [Fact]
    public async Task A_match_at_half_time_is_on_a_break_after_the_first_half()
    {
        var games = await FetchAsync(IrelandScotlandUnderWay("""
            { "clock": 2400.0, "displayClock": "40'", "period": 1,
              "type": { "id": "22", "name": "STATUS_HALFTIME", "state": "in", "completed": false, "description": "Halftime", "detail": "HT", "shortDetail": "HT" } }
            """));

        Assert.Equal((ProviderStatus.InProgress, 1, ProviderPeriodPhase.Break), (games[0].Status, games[0].Period, games[0].Phase));
    }
}
