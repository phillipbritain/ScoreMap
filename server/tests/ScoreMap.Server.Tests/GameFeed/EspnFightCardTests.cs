using System.Text.Json.Nodes;
using Microsoft.Extensions.Time.Testing;
using ScoreMap.Server.GameFeed;
using ScoreMap.Server.Tests.Support;

namespace ScoreMap.Server.Tests.GameFeed;

/// <summary>
/// Runs saved real ESPN UFC scoreboards through the adapter: a Fight Night before it started (<c>ufc.json</c>)
/// and the same card once it was over (<c>ufc-final.json</c>). One game per card, its bouts main event first
/// (ADR-0020).
/// </summary>
public sealed class EspnFightCardTests
{
    private const string Ufc = "mma/ufc";
    private const string Scoreboard = "https://espn.test/sports/mma/ufc/scoreboard";
    private const string Flags = "https://a.espncdn.com/i/teamlogos/countries/500/";

    private static string Fixture(string name) =>
        File.ReadAllText(Path.Combine(AppContext.BaseDirectory, "Fixtures", "Espn", name));

    private static async Task<ProviderGame> FetchOnly(string scoreboard)
    {
        var provider = new EspnGameFeedProvider(
            new HttpClient(StubHttpHandler.Serving((Scoreboard, scoreboard))) { BaseAddress = new Uri("https://espn.test/sports/") },
            new FakeTimeProvider(new DateTimeOffset(2026, 10, 31, 22, 0, 0, TimeSpan.Zero)));
        return Assert.Single(await provider.FetchScoreboardAsync(Ufc, CancellationToken.None));
    }

    private static ProviderBout Bout(ProviderGame game, string id) =>
        Assert.Single(Assert.IsType<ProviderBouts>(game.Contest).Bouts, bout => bout.Id == id);

    /// <summary>
    /// <c>ufc-final.json</c> as it would have stood partway through: its first eight bouts (in the order they
    /// were fought) over, the ninth in its second round, the last three still to come. No card in progress
    /// could be saved; a bout under way is taken to read as any ESPN game under way does.
    /// </summary>
    private static string CardInItsNinthBout(bool ninthOver = false)
    {
        var scoreboard = JsonNode.Parse(Fixture("ufc-final.json"))!;
        var bouts = scoreboard["events"]![0]!["competitions"]!.AsArray();
        scoreboard["events"]![0]!["status"] = JsonNode.Parse("""{ "type": { "name": "STATUS_IN_PROGRESS", "state": "in" } }""");
        if (!ninthOver)
        {
            bouts[8]!["status"] = JsonNode.Parse("""
                { "displayClock": "2:46", "period": 2,
                  "type": { "name": "STATUS_IN_PROGRESS", "state": "in", "completed": false, "description": "In Progress" } }
                """);
            ToCome(bouts[8]!);
        }
        foreach (var bout in bouts.Skip(9))
        {
            bout!["status"] = JsonNode.Parse("""
                { "displayClock": "0:00", "period": 0,
                  "type": { "name": "STATUS_SCHEDULED", "state": "pre", "completed": false, "description": "Scheduled" } }
                """);
            ToCome(bout);
        }
        return scoreboard.ToJsonString();

        static void ToCome(JsonNode bout)
        {
            bout.AsObject().Remove("details");
            foreach (var side in bout["competitors"]!.AsArray())
                side!["winner"] = false;
        }
    }

    [Fact]
    public async Task A_card_not_started_is_one_upcoming_game_of_its_bouts_main_event_first()
    {
        var game = await FetchOnly(Fixture("ufc.json"));

        Assert.Equal("600061420", game.Id);
        Assert.Equal(ProviderStatus.Scheduled, game.Status);
        Assert.Equal(new DateTimeOffset(2026, 10, 31, 21, 0, 0, TimeSpan.Zero), game.StartTime);
        Assert.Equal("UFC Fight Night: Moicano vs. Nolan", game.Note);
        var bouts = Assert.IsType<ProviderBouts>(game.Contest).Bouts;
        Assert.Equal(12, bouts.Count);
        Assert.Equal(
            new ProviderBout("401921310",
                new ProviderBoutSide("Renato Moicano", "R. Moicano", Flags + "bra.png", "21-7-1"),
                new ProviderBoutSide("Tom Nolan", "T. Nolan", Flags + "aus.png", "11-1-0"),
                "Lightweight", ScheduledRounds: 5, ProviderStatus.Scheduled),
            bouts[0]);
        Assert.All(bouts.Skip(1), bout => Assert.Equal(3, bout.ScheduledRounds));
        Assert.Null(Assert.IsType<ProviderBouts>(game.Contest).OnNow);
    }

    [Fact]
    public async Task A_card_is_at_its_bouts_venue()
    {
        var game = await FetchOnly(Fixture("ufc.json"));

        Assert.Equal(new ProviderVenue("Meta APEX", "Las Vegas", "NV", "USA", "6176"), game.Venue);
    }

    [Fact]
    public async Task A_finished_card_gives_each_bouts_winner_how_it_was_won_and_when()
    {
        var game = await FetchOnly(Fixture("ufc-final.json"));

        Assert.Equal(ProviderStatus.Final, game.Status);
        var main = Bout(game, "401921310");
        Assert.Equal((ProviderStatus.Final, 3, "1:28", BoutMethod.KnockOut), (main.Status, main.Round, main.Clock, main.Method));
        Assert.Equal((false, true), (main.First.Winner, main.Second.Winner));
        Assert.Equal((BoutMethod.Submission, 2, "1:25"), (Bout(game, "401914106").Method, Bout(game, "401914106").Round, Bout(game, "401914106").Clock));
        Assert.Equal(BoutMethod.Decision, Bout(game, "401928105").Method);
    }

    [Fact]
    public async Task A_bouts_method_is_the_last_ESPN_gave_for_it()
    {
        // ESPN first called Lisboa v Szabová a decision, then a KO/TKO, at 3:20 of the 3rd.
        var game = await FetchOnly(Fixture("ufc-final.json"));

        Assert.Equal(BoutMethod.KnockOut, Bout(game, "401914105").Method);
    }

    [Fact]
    public async Task A_card_in_progress_is_live_with_the_bout_on_now_and_the_results_of_those_over()
    {
        var game = await FetchOnly(CardInItsNinthBout());

        Assert.Equal(ProviderStatus.InProgress, game.Status);
        var onNow = Assert.IsType<ProviderBouts>(game.Contest).OnNow;
        Assert.Equal(("401928104", ProviderStatus.InProgress, 2), (onNow?.Id, onNow?.Status, onNow?.Round));
        Assert.Null(onNow!.Method);
        var over = Bout(game, "401928107");
        Assert.Equal((ProviderStatus.Final, BoutMethod.KnockOut, true), (over.Status, over.Method, over.First.Winner));
        var toCome = Bout(game, "401921310");
        Assert.Equal((ProviderStatus.Scheduled, null, false, false),
            (toCome.Status, toCome.Round, toCome.First.Winner, toCome.Second.Winner));
    }

    [Fact]
    public async Task A_card_between_bouts_is_live_with_no_bout_on()
    {
        var game = await FetchOnly(CardInItsNinthBout(ninthOver: true));

        Assert.Equal(ProviderStatus.InProgress, game.Status);
        Assert.Null(Assert.IsType<ProviderBouts>(game.Contest).OnNow);
    }
}
