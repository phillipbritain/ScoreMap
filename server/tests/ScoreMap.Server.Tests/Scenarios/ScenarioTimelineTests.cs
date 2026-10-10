using ScoreMap.Server.GameFeed;
using ScoreMap.Server.Games;
using ScoreMap.Server.Scenarios;

namespace ScoreMap.Server.Tests.Scenarios;

/// <summary>Scripted timelines, read from a scenario file and played against the time since the scenario started.</summary>
public sealed class ScenarioTimelineTests : IDisposable
{
    private static readonly League[] Leagues =
    [
        new() { Key = "football/nfl", Name = "NFL", Sport = Sport.Football },
        new() { Key = "soccer/eng.1", Name = "Premier League", Sport = Sport.Soccer },
    ];

    private static readonly ScenarioVenue[] Venues =
        [new("Arrowhead Stadium", "Kansas City", "MO", "USA", new ScenarioTeam("Kansas City Chiefs", "KC", null), ["worldwide"])];

    private static readonly DateTimeOffset StartedAt = new(2026, 10, 4, 18, 0, 0, TimeSpan.Zero);

    private readonly string _folder = Path.Combine(Path.GetTempPath(), $"scoremap-scenario-timeline-{Guid.NewGuid():N}");

    public ScenarioTimelineTests() => Directory.CreateDirectory(_folder);

    public void Dispose() => Directory.Delete(_folder, recursive: true);

    [Fact]
    public void A_score_change_is_reported_from_its_time()
    {
        var scenario = Read("""
            "length": "5m",
            "changes": [ { "at": "10s", "game": "kc-buf", "score": { "home": 21 } } ]
            """);

        Assert.Equal(14, Single(scenario, "9s").Home.Score);
        var after = Single(scenario, "10s");
        Assert.Equal(21, after.Home.Score);
        Assert.Equal(10, after.Away.Score);
    }

    [Fact]
    public void A_game_can_be_scripted_from_upcoming_through_a_break_and_a_new_period_to_final()
    {
        var scenario = Read("""
            "length": "5m",
            "changes": [
              { "at": "10s", "game": "later", "status": "live", "period": 1, "clock": "15:00" },
              { "at": "20s", "game": "later", "phase": "break" },
              { "at": "30s", "game": "later", "phase": "playing", "period": 2, "clock": "15:00" },
              { "at": "40s", "game": "later", "status": "final" }
            ]
            """, Game("later", status: "upcoming", startsIn: "10s"));

        ProviderGame Later(string elapsed) => At(scenario, elapsed).Single(g => g.Id == "later");
        Assert.Equal(ProviderStatus.Scheduled, Later("9s").Status);
        Assert.Equal((ProviderStatus.InProgress, 1, "15:00", ProviderPeriodPhase.Playing), Describe(Later("10s")));
        Assert.Equal((ProviderStatus.InProgress, 1, "15:00", ProviderPeriodPhase.Break), Describe(Later("20s")));
        Assert.Equal((ProviderStatus.InProgress, 2, "15:00", ProviderPeriodPhase.Playing), Describe(Later("30s")));
        Assert.Equal(ProviderStatus.Final, Later("40s").Status);
    }

    [Theory]
    [InlineData("postponed", ProviderStatus.Postponed)]
    [InlineData("suspended", ProviderStatus.Suspended)]
    [InlineData("canceled", ProviderStatus.Canceled)]
    public void A_game_can_be_scripted_to_be_disrupted(string status, ProviderStatus expected)
    {
        var scenario = Read($$"""
            "length": "5m",
            "changes": [ { "at": "10s", "game": "kc-buf", "status": "{{status}}" } ]
            """);

        Assert.Equal(expected, Single(scenario, "10s").Status);
    }

    [Fact]
    public void When_the_timeline_ends_it_starts_again_with_fresh_copies_of_the_games_under_new_ids()
    {
        var scenario = Read("""
            "length": "1m",
            "changes": [ { "at": "10s", "game": "kc-buf", "score": { "home": 21 }, "status": "final" } ]
            """, Game("later", status: "upcoming", startsIn: "30m"));

        var lastOfFirst = At(scenario, "59s");
        Assert.Equal(["kc-buf", "later"], lastOfFirst.Select(g => g.Id));
        Assert.Equal(ProviderStatus.Final, lastOfFirst[0].Status);

        var second = At(scenario, "1m");
        Assert.Equal(2, second.Count);
        Assert.DoesNotContain(second, g => lastOfFirst.Any(old => old.Id == g.Id));
        Assert.Equal(ProviderStatus.InProgress, second[0].Status);
        Assert.Equal(14, second[0].Home.Score);
        Assert.Equal(StartedAt.AddMinutes(1).AddMinutes(-40), second[0].StartTime);
        Assert.Equal(StartedAt.AddMinutes(1).AddMinutes(30), second[1].StartTime);

        var secondScored = At(scenario, "1m10s");
        Assert.Equal(second.Select(g => g.Id), secondScored.Select(g => g.Id));
        Assert.Equal(21, secondScored[0].Home.Score);

        var third = At(scenario, "2m");
        Assert.DoesNotContain(third, g => second.Any(old => old.Id == g.Id) || lastOfFirst.Any(old => old.Id == g.Id));
    }

    [Fact]
    public void A_scenario_without_a_timeline_never_changes_or_starts_again()
    {
        File.WriteAllText(Path.Combine(_folder, "still.json"), $$"""{ "games": [ {{Game("kc-buf")}} ] }""");
        var scenario = ScenarioReader.Read(_folder, "still", Leagues, Venues);

        var game = Single(scenario, "10h");
        Assert.Equal("kc-buf", game.Id);
        Assert.Equal(StartedAt.AddMinutes(-40), game.StartTime);
    }

    [Theory]
    [InlineData("""
        "length": "1m", "changes": [ { "at": "10s", "game": "nobody", "score": { "home": 21 } } ]
        """, "timeline change 1", "unknown game \"nobody\"", "kc-buf")]
    [InlineData("""
        "length": "1m", "changes": [ { "at": "10s", "score": { "home": 21 } } ]
        """, "timeline change 1", "no game")]
    [InlineData("""
        "length": "1m", "changes": [
          { "at": "20s", "game": "kc-buf", "score": { "home": 21 } },
          { "at": "10s", "game": "kc-buf", "score": { "home": 28 } } ]
        """, "timeline change 2", "out of order", "10s", "20s")]
    [InlineData("""
        "length": "1m", "changes": [ { "at": "-5s", "game": "kc-buf", "score": { "home": 21 } } ]
        """, "timeline change 1", "before the scenario starts")]
    [InlineData("""
        "length": "1m", "changes": [ { "at": "soon", "game": "kc-buf", "score": { "home": 21 } } ]
        """, "timeline change 1", "at \"soon\"")]
    [InlineData("""
        "length": "1m", "changes": [ { "at": "1m", "game": "kc-buf", "score": { "home": 21 } } ]
        """, "timeline change 1", "at or after the end of the timeline")]
    [InlineData("""
        "changes": [ { "at": "10s", "game": "kc-buf", "score": { "home": 21 } } ]
        """, "timeline", "length")]
    [InlineData("""
        "length": "0", "changes": [ { "at": "0", "game": "kc-buf", "score": { "home": 21 } } ]
        """, "timeline", "length \"0\"")]
    [InlineData("""
        "length": "1m", "changes": [ { "at": "10s", "game": "kc-buf", "status": "playing" } ]
        """, "timeline change 1", "unknown status \"playing\"")]
    [InlineData("""
        "length": "1m", "changes": [ { "at": "10s", "game": "kc-buf", "phase": "nap" } ]
        """, "timeline change 1", "unknown phase \"nap\"")]
    [InlineData("""
        "length": "1m", "changes": [
          { "at": "10s", "game": "kc-buf", "status": "final" },
          { "at": "20s", "game": "kc-buf", "status": "live" } ]
        """, "timeline change 2", "Final", "can't go back")]
    [InlineData("""
        "length": "1m", "changes": [ { "at": "10s", "game": "kc-buf", "score": { "away": 7 } } ]
        """, "timeline change 1", "score", "down")]
    public void A_bad_timeline_is_rejected_with_a_clear_message(string timeline, params string[] messageParts)
    {
        var error = Assert.Throws<ScenarioFileException>(() => Read(timeline));

        Assert.Contains("Scenario \"sample\"", error.Message);
        foreach (var part in messageParts)
            Assert.Contains(part, error.Message);
    }

    [Fact]
    public void A_game_written_as_final_cant_be_scripted_back_to_live()
    {
        var error = Assert.Throws<ScenarioFileException>(() => Read("""
            "length": "1m", "changes": [ { "at": "10s", "game": "done", "status": "live" } ]
            """, Game("done", status: "final")));

        Assert.Contains("can't go back", error.Message);
    }

    [Fact]
    public void Two_games_with_the_same_id_are_rejected()
    {
        var error = Assert.Throws<ScenarioFileException>(() => Read("""
            "length": "1m", "changes": [ { "at": "10s", "game": "kc-buf", "score": { "home": 21 } } ]
            """, Game("kc-buf")));

        Assert.Contains("game 2 (\"kc-buf\")", error.Message);
        Assert.Contains("same id", error.Message);
    }

    private static (ProviderStatus, int?, string?, ProviderPeriodPhase) Describe(ProviderGame game) =>
        (game.Status, game.Period, game.DisplayClock, game.Phase);

    private static ProviderGame Single(Scenario scenario, string elapsed) => Assert.Single(At(scenario, elapsed));

    private static IReadOnlyList<ProviderGame> At(Scenario scenario, string elapsed)
    {
        Assert.True(RelativeTime.TryParse(elapsed, out var time));
        return scenario.GamesAt(StartedAt, StartedAt + time);
    }

    private Scenario Read(string timeline, params string[] extraGames)
    {
        var games = string.Join(", ", [Game("kc-buf"), .. extraGames]);
        File.WriteAllText(Path.Combine(_folder, "sample.json"), $$"""{ "games": [ {{games}} ], "timeline": { {{timeline}} } }""");
        return ScenarioReader.Read(_folder, "sample", Leagues, Venues);
    }

    private static string Game(string id, string status = "live", string startsIn = "-40m") => $$"""
        {
          "id": "{{id}}",
          "league": "NFL",
          "home": { "name": "Kansas City Chiefs", "abbreviation": "KC", "score": 14 },
          "away": { "name": "Buffalo Bills", "abbreviation": "BUF", "score": 10 },
          "venue": { "name": "Arrowhead Stadium", "city": "Kansas City", "region": "MO", "country": "USA" },
          "startsIn": "{{startsIn}}",
          "status": "{{status}}",
          "clock": "8:12",
          "period": 2
        }
        """;
}
