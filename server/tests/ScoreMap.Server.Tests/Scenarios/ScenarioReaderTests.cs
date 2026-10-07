using ScoreMap.Server.GameFeed;
using ScoreMap.Server.Games;
using ScoreMap.Server.Scenarios;

namespace ScoreMap.Server.Tests.Scenarios;

public sealed class ScenarioReaderTests : IDisposable
{
    private static readonly League[] Leagues =
    [
        new() { Key = "football/nfl", Name = "NFL", Sport = Sport.AmericanFootball },
        new() { Key = "soccer/eng.1", Name = "Premier League", Sport = Sport.Soccer },
    ];

    private readonly string _folder = Path.Combine(Path.GetTempPath(), $"scoremap-scenario-reader-{Guid.NewGuid():N}");

    public ScenarioReaderTests() => Directory.CreateDirectory(_folder);

    public void Dispose() => Directory.Delete(_folder, recursive: true);

    [Theory]
    [InlineData("-40m", -40 * 60)]
    [InlineData("2h", 2 * 3600)]
    [InlineData("1h30m", 90 * 60)]
    [InlineData("90s", 90)]
    [InlineData("-1h0m5s", -3605)]
    [InlineData("+15m", 15 * 60)]
    [InlineData("0", 0)]
    public void A_games_start_is_read_relative_to_the_scenario_start(string startsIn, int seconds)
    {
        var scenario = Read(Game(startsIn: startsIn));

        Assert.Equal(TimeSpan.FromSeconds(seconds), Assert.Single(scenario.Games).StartsIn);
    }

    [Fact]
    public void A_game_is_reported_at_its_start_after_the_scenario_started()
    {
        var scenario = Read(Game(startsIn: "-40m"));
        var startedAt = new DateTimeOffset(2026, 10, 4, 18, 0, 0, TimeSpan.Zero);

        var game = Assert.Single(scenario.Games).ToProviderGame(startedAt);

        Assert.Equal(new DateTimeOffset(2026, 10, 4, 17, 20, 0, TimeSpan.Zero), game.StartTime);
    }

    [Fact]
    public void Leagues_are_named_by_name_or_key_and_games_without_an_id_are_numbered_within_the_scenario()
    {
        var scenario = Read(Game(league: "premier league"), Game(league: "football/nfl"));

        Assert.Equal(["soccer/eng.1", "football/nfl"], scenario.Games.Select(g => g.LeagueKey));
        Assert.Equal(["sample-1", "sample-2"], scenario.Games.Select(g => g.Id));
    }

    [Theory]
    [InlineData("upcoming", ProviderStatus.Scheduled)]
    [InlineData("live", ProviderStatus.InProgress)]
    [InlineData("delayed", ProviderStatus.Delayed)]
    [InlineData("final", ProviderStatus.Final)]
    [InlineData("postponed", ProviderStatus.Postponed)]
    [InlineData("suspended", ProviderStatus.Suspended)]
    [InlineData("canceled", ProviderStatus.Canceled)]
    public void Every_status_can_be_written(string status, ProviderStatus expected)
    {
        var scenario = Read(Game(status: status));

        Assert.Equal(expected, Assert.Single(scenario.Games).Status);
    }

    [Fact]
    public void A_live_game_can_be_at_a_break()
    {
        var scenario = Read(Game(status: "live", extra: """, "period": 2, "phase": "break" """));

        var game = Assert.Single(scenario.Games);
        Assert.Equal(ProviderPeriodPhase.Break, game.Phase);
        Assert.Equal(2, game.Period);
    }

    [Fact]
    public void An_unknown_phase_is_rejected()
    {
        var error = Assert.Throws<ScenarioFileException>(() => Read(Game(extra: """, "phase": "nap" """)));

        Assert.Contains("unknown phase \"nap\"", error.Message);
    }

    private Scenario Read(params string[] games)
    {
        File.WriteAllText(Path.Combine(_folder, "sample.json"), $$"""{ "games": [ {{string.Join(", ", games)}} ] }""");
        return ScenarioReader.Read(_folder, "sample", Leagues);
    }

    private static string Game(string league = "NFL", string startsIn = "0", string status = "upcoming", string extra = "") => $$"""
        {
          "league": "{{league}}",
          "home": { "name": "Kansas City Chiefs", "abbreviation": "KC" },
          "away": { "name": "Buffalo Bills", "abbreviation": "BUF" },
          "venue": { "name": "GEHA Field at Arrowhead Stadium", "city": "Kansas City", "region": "MO", "country": "USA" },
          "startsIn": "{{startsIn}}",
          "status": "{{status}}"{{extra}}
        }
        """;
}
