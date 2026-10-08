using ScoreMap.Server.GameFeed;
using ScoreMap.Server.Games;
using ScoreMap.Server.Scenarios;

namespace ScoreMap.Server.Tests.Scenarios;

/// <summary>The <c>fill</c> shorthand and its status mix, read from a scenario file.</summary>
public sealed class ScenarioFillTests : IDisposable
{
    private static readonly League[] Leagues =
    [
        new() { Key = "football/nfl", Name = "NFL", Sport = Sport.AmericanFootball, PlannedLength = TimeSpan.FromMinutes(195) },
        new() { Key = "basketball/nba", Name = "NBA", Sport = Sport.Basketball, PlannedLength = TimeSpan.FromMinutes(150) },
        new() { Key = "basketball/mens-college-basketball", Name = "NCAA Men's Basketball", Sport = Sport.Basketball, RegulationPeriods = 2, PlannedLength = TimeSpan.FromHours(2) },
        new() { Key = "baseball/mlb", Name = "MLB", Sport = Sport.Baseball, PlannedLength = TimeSpan.FromHours(3) },
        new() { Key = "hockey/nhl", Name = "NHL", Sport = Sport.Hockey, PlannedLength = TimeSpan.FromMinutes(150) },
        new() { Key = "soccer/eng.1", Name = "Premier League", Sport = Sport.Soccer, PlannedLength = TimeSpan.FromHours(2) },
    ];

    private static readonly ScenarioVenue[] Venues =
    [
        Venue("Emirates Stadium", "London", "Arsenal", "ARS", "worldwide", "london"),
        Venue("Stamford Bridge", "London", "Chelsea", "CHE", "worldwide", "london"),
        Venue("Craven Cottage", "London", "Fulham", "FUL", "worldwide", "london"),
        Venue("Wembley Stadium", "London", "England", "ENG", "worldwide", "london"),
        Venue("Madison Square Garden", "New York", "New York Knicks", "NY", "worldwide"),
        Venue("Maracanã", "Rio de Janeiro", "Flamengo", "FLA", "worldwide"),
        Venue("Scotiabank Arena", "Toronto", "Toronto Maple Leafs", "TOR", "worldwide"),
        Venue("Melbourne Cricket Ground", "Melbourne", "Melbourne Demons", "MEL", "worldwide"),
    ];

    private readonly string _folder = Path.Combine(Path.GetTempPath(), $"scoremap-scenario-fill-{Guid.NewGuid():N}");

    public ScenarioFillTests() => Directory.CreateDirectory(_folder);

    public void Dispose() => Directory.Delete(_folder, recursive: true);

    [Fact]
    public void Fill_makes_n_games_at_different_venues_in_the_group_each_with_the_venues_home_team()
    {
        var scenario = Read("""{ "fill": { "count": 3, "group": "london" } }""");

        Assert.Equal(3, scenario.Games.Count);
        Assert.Equal(3, scenario.Games.Select(g => g.Venue.Name).Distinct().Count());
        foreach (var game in scenario.Games)
        {
            var venue = Assert.Single(Venues, v => v.Name == game.Venue.Name);
            Assert.Contains("london", venue.Groups);
            Assert.Equal(venue.ToProviderVenue(), game.Venue);
            Assert.Equal((venue.HomeTeam.Abbreviation, venue.HomeTeam.Name, venue.HomeTeam.LogoUrl),
                (game.Home.Abbreviation, game.Home.FullName, game.Home.LogoUrl));
            Assert.NotEqual(game.Home.FullName, game.Away.FullName);
            Assert.Contains(Leagues, l => l.Key == game.LeagueKey);
        }
    }

    [Fact]
    public void The_status_mix_gives_each_status_its_share_of_the_filled_games()
    {
        var scenario = Read("""{ "fill": { "count": 8, "group": "worldwide", "mix": { "live": 50, "upcoming": 25, "final": 12.5, "disrupted": 12.5 } } }""");

        var statuses = scenario.Games.GroupBy(g => Status(g.Status)).ToDictionary(g => g.Key, g => g.Count());
        Assert.Equal(new Dictionary<GameStatus, int>
        {
            [GameStatus.Live] = 4,
            [GameStatus.Upcoming] = 2,
            [GameStatus.Final] = 1,
            [GameStatus.Disrupted] = 1,
        }, statuses);
    }

    [Fact]
    public void Shares_that_dont_split_evenly_go_to_the_statuses_closest_to_another_game()
    {
        var scenario = Read("""{ "fill": { "count": 4, "group": "worldwide", "mix": { "live": 1, "upcoming": 1, "final": 1 } } }""");

        var statuses = scenario.Games.Select(g => Status(g.Status)).ToList();
        Assert.Equal(4, statuses.Count);
        Assert.All([GameStatus.Live, GameStatus.Upcoming, GameStatus.Final], status => Assert.Contains(status, statuses));
        Assert.DoesNotContain(GameStatus.Disrupted, statuses);
    }

    [Fact]
    public void With_no_mix_every_filled_game_is_live()
    {
        var scenario = Read("""{ "fill": { "count": 5, "group": "worldwide" } }""");

        Assert.All(scenario.Games, game => Assert.Equal(ProviderStatus.InProgress, game.Status));
    }

    [Fact]
    public void The_same_scenario_file_makes_the_same_games_each_time()
    {
        const string json = """{ "fill": { "count": 8, "group": "worldwide", "mix": { "live": 2, "upcoming": 1, "final": 1, "disrupted": 1 } } }""";

        var first = Read(json);
        var second = Read(json);

        Assert.Equal(first.Games, second.Games, GameComparer);
        Assert.Equal(8, first.Games.Select(g => g.Id).Distinct().Count());
    }

    [Fact]
    public void Games_written_out_one_by_one_sit_next_to_filled_ones()
    {
        var scenario = Read("""
            {
              "games": [
                {
                  "id": "written",
                  "league": "NFL",
                  "home": { "name": "Kansas City Chiefs", "abbreviation": "KC" },
                  "away": { "name": "Buffalo Bills", "abbreviation": "BUF" },
                  "venue": { "name": "Madison Square Garden", "city": "New York" },
                  "startsIn": "1h",
                  "status": "upcoming"
                }
              ],
              "fill": { "count": 2, "group": "london" }
            }
            """);

        Assert.Equal(3, scenario.Games.Count);
        Assert.Equal("written", scenario.Games[0].Id);
        Assert.Equal(3, scenario.Games.Select(g => g.Id).Distinct().Count());
    }

    [Theory]
    [InlineData("""{ "fill": { "count": 5, "group": "london" } }""", "5 games", "\"london\"", "only 4 venues")]
    [InlineData("""{ "fill": { "count": 2, "group": "paris" } }""", "unknown group \"paris\"", "worldwide, london")]
    [InlineData("""{ "fill": { "count": 2 } }""", "fill has no group")]
    [InlineData("""{ "fill": { "count": 0, "group": "london" } }""", "count 0")]
    [InlineData("""{ "fill": { "count": 2, "group": "london", "mix": { "playing": 1 } } }""", "unknown status \"playing\"", "upcoming, live, final, disrupted")]
    [InlineData("""{ "fill": { "count": 2, "group": "london", "mix": { "live": -1, "final": 2 } } }""", "share -1")]
    [InlineData("""{ "fill": { "count": 2, "group": "london", "mix": { "live": 0 } } }""", "no games to any status")]
    public void A_fill_that_cant_be_made_says_why(string json, params string[] messageParts)
    {
        var error = Assert.Throws<ScenarioFileException>(() => Read(json));

        Assert.Contains("Scenario \"sample\"", error.Message);
        foreach (var part in messageParts)
            Assert.Contains(part, error.Message);
    }

    [Fact]
    public void A_fill_with_no_venue_list_says_so()
    {
        File.WriteAllText(Path.Combine(_folder, "sample.json"), """{ "fill": { "count": 2, "group": "london" } }""");

        var error = Assert.Throws<ScenarioFileException>(() => ScenarioReader.Read(_folder, "sample", Leagues));

        Assert.Contains("no venue list", error.Message);
    }

    // Records compare their lists by reference, so compare games by what they say.
    private static readonly IEqualityComparer<ScenarioGame> GameComparer = EqualityComparer<ScenarioGame>.Create(
        (a, b) => a!.ToProviderGame(DateTimeOffset.UnixEpoch).ToString() == b!.ToProviderGame(DateTimeOffset.UnixEpoch).ToString());

    private static GameStatus Status(ProviderStatus status) => status switch
    {
        ProviderStatus.Scheduled => GameStatus.Upcoming,
        ProviderStatus.InProgress => GameStatus.Live,
        ProviderStatus.Final => GameStatus.Final,
        ProviderStatus.Postponed or ProviderStatus.Suspended or ProviderStatus.Canceled => GameStatus.Disrupted,
        _ => throw new ArgumentOutOfRangeException(nameof(status), status, "Filled games are never this"),
    };

    private Scenario Read(string json)
    {
        File.WriteAllText(Path.Combine(_folder, "sample.json"), json);
        return ScenarioReader.Read(_folder, "sample", Leagues, Venues);
    }

    private static ScenarioVenue Venue(string name, string city, string team, string abbreviation, params string[] groups) =>
        new(name, city, null, "Somewhere", new ScenarioTeam(team, abbreviation, $"https://example.com/{abbreviation}.png"), groups);
}
