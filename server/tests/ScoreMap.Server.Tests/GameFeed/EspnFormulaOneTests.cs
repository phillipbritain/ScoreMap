using System.Text.Json.Nodes;
using Microsoft.Extensions.Time.Testing;
using ScoreMap.Server.GameFeed;
using ScoreMap.Server.Tests.Support;

namespace ScoreMap.Server.Tests.GameFeed;

/// <summary>
/// Runs a saved real ESPN F1 scoreboard (the Mexico City Grand Prix during FP2) through the adapter: one game per
/// weekend, its race only (ADR-0020).
/// </summary>
public sealed class EspnFormulaOneTests : IDisposable
{
    private const string F1 = "racing/f1";
    private const string Scoreboard = "https://espn.test/sports/racing/f1/scoreboard";

    private readonly string _folder = Path.Combine(Path.GetTempPath(), $"scoremap-espn-f1-{Guid.NewGuid():N}");

    public void Dispose()
    {
        if (Directory.Exists(_folder))
            Directory.Delete(_folder, recursive: true);
    }

    private static string Fixture(string name) =>
        File.ReadAllText(Path.Combine(AppContext.BaseDirectory, "Fixtures", "Espn", name));

    private EspnGameFeedProvider ProviderOver(StubHttpHandler handler) => new(
        new HttpClient(handler) { BaseAddress = new Uri("https://espn.test/sports/") },
        new FakeTimeProvider(new DateTimeOffset(2026, 10, 30, 22, 30, 0, TimeSpan.Zero)),
        Path.Combine(_folder, "event-venues.json"));

    private async Task<ProviderGame> FetchOnly(string scoreboard) => Assert.Single(
        await ProviderOver(StubHttpHandler.Serving((Scoreboard, scoreboard))).FetchScoreboardAsync(F1, CancellationToken.None));

    /// <summary>
    /// <c>f1.json</c> with its race under way on lap 42, its field FP2's: a race in progress, which the saved
    /// response doesn't have.
    /// </summary>
    private static string RaceOnLap42()
    {
        var scoreboard = JsonNode.Parse(Fixture("f1.json"))!;
        var competitions = scoreboard["events"]![0]!["competitions"]!.AsArray();
        var race = competitions.Single(c => (string?)c!["type"]!["abbreviation"] == "Race")!;
        var practice = competitions.Single(c => (string?)c!["type"]!["abbreviation"] == "FP2")!;
        race["competitors"] = practice["competitors"]!.DeepClone();
        race["status"] = JsonNode.Parse("""
            { "period": 42, "type": { "name": "STATUS_IN_PROGRESS", "state": "in", "completed": false, "description": "In Progress" } }
            """);
        return scoreboard.ToJsonString();
    }

    [Fact]
    public async Task A_grand_prix_is_one_upcoming_game_timed_by_its_race_while_practice_runs()
    {
        var game = await FetchOnly(Fixture("f1.json"));

        Assert.Equal("600057447", game.Id);
        Assert.Equal(new DateTimeOffset(2026, 11, 1, 20, 0, 0, TimeSpan.Zero), game.StartTime);
        Assert.Equal(ProviderStatus.Scheduled, game.Status);
        Assert.Null(game.Period);
        Assert.Empty(Assert.IsType<ProviderField>(game.Contest).Entries);
        Assert.Equal("Mexico City Grand Prix", game.Note);
    }

    [Fact]
    public async Task A_grand_prix_is_at_its_circuit_from_the_scoreboard_without_asking_the_core_api()
    {
        var handler = StubHttpHandler.Serving((Scoreboard, Fixture("f1.json")));

        var game = Assert.Single(await ProviderOver(handler).FetchScoreboardAsync(F1, CancellationToken.None));

        Assert.Equal(new ProviderVenue("Autodromo Hermanos Rodriguez", "Mexico city", null, "Mexico", "782"), game.Venue);
        Assert.DoesNotContain(handler.Requests, request => request.RequestUri!.Host == "sports.core.api.espn.com");
    }

    [Fact]
    public async Task A_race_under_way_gives_its_field_in_order_and_its_lap()
    {
        var game = await FetchOnly(RaceOnLap42());

        Assert.Equal(ProviderStatus.InProgress, game.Status);
        Assert.Equal(42, game.Period);
        var field = Assert.IsType<ProviderField>(game.Contest);
        Assert.Equal(22, field.Entries.Count);
        Assert.Equal(Enumerable.Range(1, 22), field.Entries.Select(entrant => entrant.Position));
        Assert.Equal(
            new ProviderEntrant(1, "Charles Leclerc", "C. Leclerc", "https://a.espncdn.com/i/teamlogos/countries/500/mon.png"),
            field.Entries[0]);
    }
}
