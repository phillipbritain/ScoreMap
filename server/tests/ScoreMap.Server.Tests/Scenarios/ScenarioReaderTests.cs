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

    // A slice of the venue list: venues are known by name and city, as the venue locator looks them up.
    private static readonly ScenarioVenue[] Venues =
    [
        Venue("Arrowhead Stadium", "Kansas City", "MO", "USA"),
        Venue("Allianz Stadium", "Turin", null, "Italy"),
        Venue("Allianz Stadium", "Sydney", "NSW", "Australia"),
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

    [Theory]
    [InlineData("""{ "name": "Arrowhed Stadium", "city": "Kansas City" }""", "unknown venue \"Arrowhed Stadium\" in Kansas City")]
    [InlineData("""{ "name": "Allianz Stadium", "city": "Melbourne" }""", "unknown venue \"Allianz Stadium\" in Melbourne", "Turin, Sydney")]
    [InlineData("""{ "name": "Arrowhead Stadium", "city": "Kansas City", "country": "Canada" }""", "Arrowhead Stadium", "country \"Canada\"", "\"USA\"")]
    [InlineData("""{ "name": "Arrowhead Stadium", "city": "Kansas City", "notInVenueList": true }""", "Arrowhead Stadium", "is in the venue list", "notInVenueList")]
    public void A_venue_not_as_the_venue_list_has_it_is_rejected(string venue, params string[] messageParts)
    {
        var error = Assert.Throws<ScenarioFileException>(() => Read(Game(venue: venue)));

        Assert.Contains("game 1", error.Message);
        foreach (var part in messageParts)
            Assert.Contains(part, error.Message);
    }

    [Fact]
    public void An_unknown_venue_says_how_to_keep_it_deliberately()
    {
        var error = Assert.Throws<ScenarioFileException>(() => Read(Game(venue: """{ "name": "Nowhere Park", "city": "Reykjavík" }""")));

        Assert.Contains("\"notInVenueList\": true", error.Message);
    }

    [Fact]
    public void A_venue_marked_as_deliberately_not_in_the_venue_list_is_kept()
    {
        var scenario = Read(Game(venue: """{ "name": "Imaginary Fields Arena", "city": "Reykjavík", "country": "Iceland", "notInVenueList": true }"""));

        Assert.Equal(new ProviderVenue("Imaginary Fields Arena", "Reykjavík", null, "Iceland"), Assert.Single(scenario.Games).Venue);
    }

    [Fact]
    public void A_venue_from_the_list_can_be_written_with_just_its_name_and_city()
    {
        var scenario = Read(Game(venue: """{ "name": "Allianz Stadium", "city": "Sydney" }"""));

        Assert.Equal(new ProviderVenue("Allianz Stadium", "Sydney", "NSW", "Australia"), Assert.Single(scenario.Games).Venue);
    }

    [Fact]
    public void Written_out_games_need_the_venue_list_to_check_their_venues_against()
    {
        File.WriteAllText(Path.Combine(_folder, "sample.json"), $$"""{ "games": [ {{Game()}} ] }""");

        var error = Assert.Throws<ScenarioFileException>(() => ScenarioReader.Read(_folder, "sample", Leagues));

        Assert.Contains("no venue list", error.Message);
    }

    private Scenario Read(params string[] games)
    {
        File.WriteAllText(Path.Combine(_folder, "sample.json"), $$"""{ "games": [ {{string.Join(", ", games)}} ] }""");
        return ScenarioReader.Read(_folder, "sample", Leagues, Venues);
    }

    private static ScenarioVenue Venue(string name, string city, string? region, string country) =>
        new(name, city, region, country, new ScenarioTeam("Home", "HOM", null), ["worldwide"]);

    private const string Arrowhead = """{ "name": "Arrowhead Stadium", "city": "Kansas City", "region": "MO", "country": "USA" }""";

    private static string Game(string league = "NFL", string startsIn = "0", string status = "upcoming", string extra = "", string venue = Arrowhead) => $$"""
        {
          "league": "{{league}}",
          "home": { "name": "Kansas City Chiefs", "abbreviation": "KC" },
          "away": { "name": "Buffalo Bills", "abbreviation": "BUF" },
          "venue": {{venue}},
          "startsIn": "{{startsIn}}",
          "status": "{{status}}"{{extra}}
        }
        """;
}
