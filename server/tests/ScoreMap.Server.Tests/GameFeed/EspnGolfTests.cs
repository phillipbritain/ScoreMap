using Microsoft.Extensions.Time.Testing;
using ScoreMap.Server.GameFeed;
using ScoreMap.Server.Tests.Support;

namespace ScoreMap.Server.Tests.GameFeed;

/// <summary>
/// Runs saved real ESPN scoreboards and the core API's events through the adapter: the PGA Tour's Mexico Open in
/// round 2, and the LPGA Tour's Maybank Championship once Final.
/// </summary>
public sealed class EspnGolfTests : IDisposable
{
    private const string Pga = "golf/pga";
    private const string PgaScoreboard = "https://espn.test/sports/golf/pga/scoreboard";
    private const string PgaCoreEvent = "https://sports.core.api.espn.com/v2/sports/golf/leagues/pga/events/401850978";
    private const string Lpga = "golf/lpga";
    private const string LpgaScoreboard = "https://espn.test/sports/golf/lpga/scoreboard";
    private const string LpgaCoreEvent = "https://sports.core.api.espn.com/v2/sports/golf/leagues/lpga/events/401835174";

    private readonly string _folder = Path.Combine(Path.GetTempPath(), $"scoremap-espn-golf-{Guid.NewGuid():N}");

    public void Dispose()
    {
        if (Directory.Exists(_folder))
            Directory.Delete(_folder, recursive: true);
    }

    private static string Fixture(string name) =>
        File.ReadAllText(Path.Combine(AppContext.BaseDirectory, "Fixtures", "Espn", name));

    private EspnGameFeedProvider ProviderOver(StubHttpHandler handler) => new(
        new HttpClient(handler) { BaseAddress = new Uri("https://espn.test/sports/") },
        new FakeTimeProvider(new DateTimeOffset(2026, 10, 30, 22, 0, 0, TimeSpan.Zero)),
        Path.Combine(_folder, "event-venues.json"));

    private static StubHttpHandler MexicoOpen(string scoreboard) => StubHttpHandler.Serving(
        (PgaScoreboard, scoreboard),
        (PgaCoreEvent, Fixture("golf-pga-core-event.json")));

    private async Task<ProviderGame> TournamentAsync(string scoreboard) =>
        Assert.Single(await ProviderOver(MexicoOpen(scoreboard)).FetchScoreboardAsync(Pga, CancellationToken.None));

    [Fact]
    public async Task A_tournament_is_one_live_game_in_its_round_with_its_field_in_order_and_scores_to_par()
    {
        var game = await TournamentAsync(Fixture("golf-pga.json"));

        Assert.Equal("401850978", game.Id);
        Assert.Equal(ProviderStatus.InProgress, game.Status);
        Assert.Equal(2, game.Period);
        Assert.Equal(ProviderPeriodPhase.Playing, game.Phase);
        Assert.Equal("VidantaWorld Mexico Open", game.Note);
        var field = Assert.IsType<ProviderField>(game.Contest);
        Assert.Equal(120, field.Entries.Count);
        Assert.Equal(
            new ProviderEntrant(1, "Ben Griffin", "B. Griffin", "https://a.espncdn.com/i/teamlogos/countries/500/usa.png", -12, 14),
            field.Entries[0]);
        Assert.Equal(("M. Pavon", -11, 18), (field.Entries[2].ShortName, field.Entries[2].ToPar, field.Entries[2].Thru));
    }

    [Fact]
    public async Task Golfers_level_on_score_share_their_position()
    {
        var field = Assert.IsType<ProviderField>((await TournamentAsync(Fixture("golf-pga.json"))).Contest);

        // ESPN orders the four at -11 2nd to 5th; they are all T2, and the next golfer 6th.
        Assert.Equal([1, 2, 2, 2, 2, 6], field.Entries.Take(6).Select(entrant => entrant.Position));
        Assert.Equal(0, field.Entries.Single(entrant => entrant.Name == "Kevin Yu").ToPar);
    }

    [Fact]
    public async Task A_tournament_is_at_its_first_course_from_the_core_api()
    {
        var game = await TournamentAsync(Fixture("golf-pga.json"));

        Assert.Equal(new ProviderVenue("Vidanta Vallarta", "Nuevo Vallarta", null, "Mexico", "11163"), game.Venue);
    }

    [Fact]
    public async Task Once_every_golfer_has_finished_the_round_or_not_begun_it_play_is_between_rounds()
    {
        // Every golfer part-way through round 2 has finished it.
        var scoreboard = System.Text.Json.Nodes.JsonNode.Parse(Fixture("golf-pga.json"))!;
        foreach (var golfer in scoreboard["events"]![0]!["competitions"]![0]!["competitors"]!.AsArray())
        {
            var round = golfer!["linescores"]!.AsArray().FirstOrDefault(l => (int?)l!["period"] == 2)?["linescores"]?.AsArray();
            while (round is { Count: > 0 and < 18 })
                round.Add(round[^1]!.DeepClone());
        }

        var game = await TournamentAsync(scoreboard.ToJsonString());

        Assert.Equal((ProviderStatus.InProgress, 2, ProviderPeriodPhase.Break), (game.Status, game.Period, game.Phase));
    }

    [Fact]
    public async Task An_LPGA_tournament_is_one_game_with_its_field_scores_to_par_and_round_at_its_first_course()
    {
        var game = Assert.Single(await ProviderOver(StubHttpHandler.Serving(
                (LpgaScoreboard, Fixture("golf-lpga.json")),
                (LpgaCoreEvent, Fixture("golf-lpga-core-event.json"))))
            .FetchScoreboardAsync(Lpga, CancellationToken.None));

        Assert.Equal(("401835174", ProviderStatus.Final, 4), (game.Id, game.Status, game.Period));
        Assert.Equal("Maybank Championship", game.Note);
        var field = Assert.IsType<ProviderField>(game.Contest);
        Assert.Equal(78, field.Entries.Count);
        Assert.Equal(
            [(1, "Miyu Yamashita", -22), (2, "Yan Liu", -20), (3, "Marisa Tojai", -19), (3, "Pauline Roussin-Bouchard", -19), (5, "Robyn Choi", -17)],
            field.Entries.Take(5).Select(entrant => (entrant.Position, entrant.Name, entrant.ToPar)));
        Assert.Equal(
            new ProviderVenue("Kuala Lumpur Golf and Country Club (West Course)", "Kuala Lumpur", null, "Malaysia", "11198"),
            game.Venue);
    }
}
