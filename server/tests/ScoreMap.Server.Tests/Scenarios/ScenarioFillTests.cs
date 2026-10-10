using ScoreMap.Server.GameFeed;
using ScoreMap.Server.Games;
using ScoreMap.Server.Scenarios;

namespace ScoreMap.Server.Tests.Scenarios;

/// <summary>The <c>fill</c> shorthand and its status mix, read from a scenario file.</summary>
public sealed class ScenarioFillTests : IDisposable
{
    private static readonly League[] Leagues =
    [
        new() { Key = "football/nfl", Name = "NFL", Sport = Sport.Football, PlannedLength = TimeSpan.FromMinutes(195) },
        new() { Key = "basketball/nba", Name = "NBA", Sport = Sport.Basketball, PlannedLength = TimeSpan.FromMinutes(150) },
        new() { Key = "basketball/mens-college-basketball", Name = "NCAA Men's Basketball", Sport = Sport.Basketball, RegulationPeriods = 2, PeriodMinutes = 20, PlannedLength = TimeSpan.FromHours(2) },
        new() { Key = "baseball/mlb", Name = "MLB", Sport = Sport.Baseball, PlannedLength = TimeSpan.FromHours(3) },
        new() { Key = "hockey/nhl", Name = "NHL", Sport = Sport.Hockey, PlannedLength = TimeSpan.FromMinutes(150) },
        new() { Key = "soccer/eng.1", Name = "Premier League", Sport = Sport.Soccer, PlannedLength = TimeSpan.FromHours(2) },
    ];

    private static readonly ScenarioVenue[] Venues =
    [
        Venue("Emirates Stadium", "London", "worldwide", "london"),
        Venue("Stamford Bridge", "London", "worldwide", "london"),
        Venue("Craven Cottage", "London", "worldwide", "london"),
        Venue("Wembley Stadium", "London", "worldwide", "london"),
        Venue("Madison Square Garden", "New York", "worldwide"),
        Venue("Maracanã", "Rio de Janeiro", "worldwide"),
        Venue("Scotiabank Arena", "Toronto", "worldwide"),
        Venue("Melbourne Cricket Ground", "Melbourne", "worldwide"),
    ];

    // Four made-up teams in each league, named for it ("NFL team 1"): room for two games per league at a time.
    private static readonly ScenarioTeamList Teams = TeamsPerLeague(4);

    private readonly string _folder = Path.Combine(Path.GetTempPath(), $"scoremap-scenario-fill-{Guid.NewGuid():N}");

    public ScenarioFillTests() => Directory.CreateDirectory(_folder);

    public void Dispose() => Directory.Delete(_folder, recursive: true);

    [Fact]
    public void Fill_makes_n_games_at_different_venues_in_the_group_each_between_two_teams_of_its_league()
    {
        var scenario = Read("""{ "fill": { "count": 3, "group": "london" } }""");

        Assert.Equal(3, scenario.Games.Count);
        Assert.Equal(3, scenario.Games.Select(g => g.Venue.Name).Distinct().Count());
        foreach (var game in scenario.Games)
        {
            var venue = Assert.Single(Venues, v => v.Name == game.Venue.Name);
            Assert.Contains("london", venue.Groups);
            Assert.Equal(venue.ToProviderVenue(), game.Venue);
            var league = Assert.Single(Leagues, l => l.Key == game.LeagueKey);
            Assert.Contains(Teams.For(league), team => team.Name == game.Home.FullName);
            Assert.Contains(Teams.For(league), team => team.Name == game.Away.FullName);
            Assert.NotEqual(game.Home.FullName, game.Away.FullName);
        }
    }

    [Fact]
    public void The_status_mix_gives_each_status_its_share_of_the_filled_games()
    {
        var scenario = Read("""{ "fill": { "count": 8, "group": "worldwide", "mix": { "live": 50, "upcoming": 37.5, "final": 12.5 } } }""");

        var statuses = scenario.Games.GroupBy(g => Status(g.Status)).ToDictionary(g => g.Key, g => g.Count());
        Assert.Equal(new Dictionary<GameStatus, int>
        {
            [GameStatus.Live] = 4,
            [GameStatus.Upcoming] = 3,
            [GameStatus.Final] = 1,
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
    public void A_fills_disrupted_games_are_postponed_suspended_and_canceled_in_turn()
    {
        var scenario = Read("""{ "fill": { "count": 8, "group": "worldwide" }, "play": true, "disrupted": 0.375 }""");

        var disruptions = scenario.Games.Select(g => g.Status).Where(s => Status(s) == GameStatus.Disrupted).Order();
        Assert.Equal([ProviderStatus.Postponed, ProviderStatus.Suspended, ProviderStatus.Canceled], disruptions);
    }

    [Fact]
    public void The_same_scenario_file_makes_the_same_games_each_time()
    {
        const string json = """{ "fill": { "count": 8, "group": "worldwide", "mix": { "live": 2, "upcoming": 1, "final": 1 } }, "play": true, "disrupted": 0.25 }""";

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
    [InlineData("""{ "fill": { "count": 2, "group": "london", "mix": { "playing": 1 } } }""", "unknown status \"playing\"", "upcoming, live, final")]
    [InlineData("""{ "fill": { "count": 2, "group": "london", "mix": { "live": 1, "disrupted": 1 } } }""", "mix", "disrupted", "\"disrupted\" beside \"play\"")]
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

    [Fact]
    public void No_team_is_in_two_filled_games_nor_in_a_game_written_out()
    {
        // Six leagues of two teams: room for six games, one written out and five filled.
        var scenario = Read(teams: TeamsPerLeague(2), json: """
            {
              "games": [ { "league": "NBA", "home": { "name": "NBA team 1", "abbreviation": "T1" }, "away": { "name": "NBA team 2", "abbreviation": "T2" },
                           "venue": { "name": "Madison Square Garden", "city": "New York" }, "startsIn": "1h", "status": "upcoming" } ],
              "fill": { "count": 5, "group": "worldwide" }
            }
            """);

        var teams = scenario.Games.SelectMany(g => new[] { (g.LeagueKey, g.Home.FullName), (g.LeagueKey, g.Away.FullName) }).ToList();
        Assert.Equal(12, teams.Count);
        Assert.Equal(teams.Count, teams.Distinct().Count());
    }

    [Fact]
    public void A_fill_asking_for_more_games_than_the_team_list_has_free_teams_for_says_so()
    {
        File.WriteAllText(Path.Combine(_folder, "sample.json"), """{ "fill": { "count": 7, "group": "worldwide" } }""");

        // Six leagues of two teams: room for six games.
        var error = Assert.Throws<ScenarioFileException>(() => ScenarioReader.Read(_folder, "sample", Leagues, Venues, TeamsPerLeague(2)));

        Assert.Contains("asks for 7 games, but the team list has free teams for only 6 of them", error.Message);
    }

    [Fact]
    public void A_fill_short_of_teams_beside_games_written_out_says_how_many_are_written_out()
    {
        File.WriteAllText(Path.Combine(_folder, "sample.json"), """
            {
              "games": [ { "league": "NBA", "home": { "name": "NBA team 1", "abbreviation": "T1" }, "away": { "name": "NBA team 2", "abbreviation": "T2" },
                           "venue": { "name": "Madison Square Garden", "city": "New York" }, "startsIn": "1h", "status": "upcoming" } ],
              "fill": { "count": 6, "group": "worldwide" }
            }
            """);

        // Six leagues of two teams: room for six games, one of them written out.
        var error = Assert.Throws<ScenarioFileException>(() => ScenarioReader.Read(_folder, "sample", Leagues, Venues, TeamsPerLeague(2)));

        Assert.Contains("asks for 6 games, but the team list has free teams for only 5 of them beside the 1 written out", error.Message);
    }

    [Fact]
    public void A_fill_with_no_team_list_says_so()
    {
        File.WriteAllText(Path.Combine(_folder, "sample.json"), """{ "fill": { "count": 2, "group": "london" } }""");

        var error = Assert.Throws<ScenarioFileException>(() => ScenarioReader.Read(_folder, "sample", Leagues, Venues));

        Assert.Contains("no team list", error.Message);
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

    private Scenario Read(string json, ScenarioTeamList? teams = null)
    {
        File.WriteAllText(Path.Combine(_folder, "sample.json"), json);
        return ScenarioReader.Read(_folder, "sample", Leagues, Venues, teams ?? Teams);
    }

    private static ScenarioVenue Venue(string name, string city, params string[] groups) => new(name, city, null, "Somewhere", groups);

    private static ScenarioTeamList TeamsPerLeague(int count) => new(Leagues.ToDictionary(
        l => l.Name,
        l => (IReadOnlyList<ScenarioTeam>)Enumerable.Range(1, count)
            .Select(n => new ScenarioTeam($"{l.Name} team {n}", $"T{n}", $"https://example.com/{l.Key}/{n}.png")).ToList()));
}
