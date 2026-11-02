using ScoreMap.Server.GameFeed;
using ScoreMap.Server.Games;
using ScoreMap.Server.Scenarios;

namespace ScoreMap.Server.Tests.Scenarios;

/// <summary>A fight card written out in full in a scenario file, its bouts main event first (ADR-0020).</summary>
public sealed class ScenarioFightCardTests : IDisposable
{
    private static readonly League[] Leagues =
    [
        new() { Key = "football/nfl", Name = "NFL", Sport = Sport.Football },
        new() { Key = "mma/ufc", Name = "UFC", Sport = Sport.Mma },
    ];

    private static readonly ScenarioVenue[] Venues = [new("Madison Square Garden", "New York", "NY", "USA", ["worldwide"])];

    private readonly string _folder = Path.Combine(Path.GetTempPath(), $"scoremap-scenario-fight-card-{Guid.NewGuid():N}");

    public ScenarioFightCardTests() => Directory.CreateDirectory(_folder);

    public void Dispose() => Directory.Delete(_folder, recursive: true);

    private const string Usa = "https://a.espncdn.com/i/teamlogos/countries/500/usa.png";

    private const string MainEvent = $$"""
        { "weightClass": "Heavyweight", "rounds": 5, "status": "live", "round": 2, "clock": "3:12",
          "first": { "name": "Jon Jones", "shortName": "J. Jones", "flag": "{{Usa}}", "record": "27-1-0" },
          "second": { "name": "Stipe Miocic", "shortName": "S. Miocic", "record": "20-4-0" } }
        """;

    private const string Prelim = $$"""
        { "weightClass": "Lightweight", "status": "final", "round": 1, "clock": "2:05", "method": "submission",
          "first": { "name": "Paddy Pimblett", "shortName": "P. Pimblett", "record": "22-3-0", "winner": true },
          "second": { "name": "Michael Chandler", "shortName": "M. Chandler", "record": "23-9-0" } }
        """;

    private Scenario Read(string status = "live", string bouts = $"{MainEvent}, {Prelim}", string extra = "")
    {
        File.WriteAllText(Path.Combine(_folder, "sample.json"), $$"""
            { "games": [ {
              "id": "card", "league": "UFC", "note": "UFC 309: Jones vs. Miocic",
              "venue": { "name": "Madison Square Garden", "city": "New York" },
              "startsIn": "-2h", "status": "{{status}}", "bouts": [ {{bouts}} ] } ]{{extra}} }
            """);
        return ScenarioReader.Read(_folder, "sample", Leagues, Venues);
    }

    [Fact]
    public void A_fight_card_is_read_with_its_bouts_main_event_first()
    {
        var game = Assert.Single(Read().Games);

        var bouts = Assert.IsType<ProviderBouts>(game.Contest).Bouts;
        Assert.Equal(
            new ProviderBout("card-bout-1",
                new ProviderBoutSide("Jon Jones", "J. Jones", Usa, "27-1-0"),
                new ProviderBoutSide("Stipe Miocic", "S. Miocic", null, "20-4-0"),
                "Heavyweight", 5, ProviderStatus.InProgress, 2, "3:12"),
            bouts[0]);
        Assert.Equal(
            new ProviderBout("card-bout-2",
                new ProviderBoutSide("Paddy Pimblett", "P. Pimblett", null, "22-3-0", Winner: true),
                new ProviderBoutSide("Michael Chandler", "M. Chandler", null, "23-9-0"),
                "Lightweight", 3, ProviderStatus.Final, 1, "2:05", BoutMethod.Submission),
            bouts[1]);
        Assert.Equal("UFC 309: Jones vs. Miocic", game.Note);
    }

    [Fact]
    public void A_fight_card_whose_status_its_bouts_dont_bear_out_is_refused()
    {
        var error = Assert.Throws<ScenarioFileException>(() => Read(status: "final"));

        Assert.Contains("its bouts make it live", error.Message);
    }

    [Fact]
    public void A_bout_with_an_unknown_method_is_refused()
    {
        var error = Assert.Throws<ScenarioFileException>(() => Read(bouts: Prelim.Replace("submission", "armbar")));

        Assert.Contains("unknown method \"armbar\"", error.Message);
    }

    [Fact]
    public void A_fight_card_with_no_bouts_is_refused()
    {
        var error = Assert.Throws<ScenarioFileException>(() => Read(bouts: ""));

        Assert.Contains("has no bouts", error.Message);
    }

    [Fact]
    public void A_timeline_can_finish_a_bout()
    {
        var scenario = Read(extra: """
            , "timeline": { "length": "10m", "changes": [ { "at": "1m", "game": "card", "status": "final",
              "bouts": [
              { "rounds": 5, "status": "final", "round": 5, "method": "decision",
                "first": { "name": "Jon Jones", "shortName": "J. Jones", "winner": true },
                "second": { "name": "Stipe Miocic", "shortName": "S. Miocic" } } ] } ] }
            """);
        var changed = scenario.Timeline!.Changes[0].ApplyTo(scenario.Games[0]);
        Assert.Equal(ProviderStatus.Final, changed.Status);
        Assert.True(Assert.IsType<ProviderBouts>(changed.Contest).Bouts[0].First.Winner);
    }
}
