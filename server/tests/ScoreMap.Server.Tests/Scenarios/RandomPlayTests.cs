using ScoreMap.Server.GameFeed;
using ScoreMap.Server.Games;
using ScoreMap.Server.Scenarios;

namespace ScoreMap.Server.Tests.Scenarios;

/// <summary>
/// Random play (<c>"play": "random"</c>), read from a scenario file and played second by second
/// from the scenario's start with a fixed random seed.
/// </summary>
public sealed class RandomPlayTests : IDisposable
{
    private static readonly League[] Leagues =
    [
        new() { Key = "football/nfl", Name = "NFL", Sport = Sport.AmericanFootball, PlannedLength = TimeSpan.FromMinutes(195) },
        new() { Key = "football/college-football", Name = "NCAA Football", Sport = Sport.AmericanFootball, PlannedLength = TimeSpan.FromMinutes(210) },
        new() { Key = "basketball/nba", Name = "NBA", Sport = Sport.Basketball, PlannedLength = TimeSpan.FromMinutes(150) },
        new() { Key = "basketball/mens-college-basketball", Name = "NCAA Men's Basketball", Sport = Sport.Basketball, RegulationPeriods = 2, PlannedLength = TimeSpan.FromHours(2) },
        new() { Key = "baseball/mlb", Name = "MLB", Sport = Sport.Baseball, PlannedLength = TimeSpan.FromHours(3) },
        new() { Key = "hockey/nhl", Name = "NHL", Sport = Sport.Hockey, PlannedLength = TimeSpan.FromMinutes(150) },
        new() { Key = "soccer/usa.1", Name = "MLS", Sport = Sport.Soccer, PlannedLength = TimeSpan.FromHours(2) },
        new() { Key = "soccer/eng.1", Name = "Premier League", Sport = Sport.Soccer, PlannedLength = TimeSpan.FromHours(2) },
        new() { Key = "soccer/uefa.champions", Name = "Champions League", Sport = Sport.Soccer, PlannedLength = TimeSpan.FromHours(2) },
        new() { Key = "soccer/fifa.world", Name = "World Cup", Sport = Sport.Soccer, PlannedLength = TimeSpan.FromHours(2) },
    ];

    // 100 venues around the world, the first 10 of them also in "london".
    private static readonly ScenarioVenue[] Venues = Enumerable.Range(1, 100)
        .Select(n => new ScenarioVenue($"Stadium {n}", $"City {n}", null, "Somewhere",
            new ScenarioTeam($"Team {n}", $"T{n}", null), n <= 10 ? ["worldwide", "london"] : ["worldwide"]))
        .ToArray();

    // The most a team plausibly scores in a whole game (as in ScenarioGameMakerTests).
    private static readonly Dictionary<Sport, int> MostPoints = new()
    {
        [Sport.AmericanFootball] = 50,
        [Sport.Basketball] = 140,
        [Sport.Baseball] = 12,
        [Sport.Hockey] = 8,
        [Sport.Soccer] = 6,
    };

    private const string Busy = """{ "fill": { "count": 60, "group": "worldwide" }, "play": "random" }""";

    private static readonly DateTimeOffset StartedAt = new(2026, 10, 4, 18, 0, 0, TimeSpan.Zero);

    private readonly string _folder = Path.Combine(Path.GetTempPath(), $"scoremap-random-play-{Guid.NewGuid():N}");

    public RandomPlayTests() => Directory.CreateDirectory(_folder);

    public void Dispose() => Directory.Delete(_folder, recursive: true);

    [Fact]
    public void Live_games_score_change_periods_go_to_breaks_and_finish()
    {
        var feed = EverySecond(Read(Busy), TimeSpan.FromMinutes(10));

        var byGame = feed.SelectMany(games => games).GroupBy(game => game.Id).ToList();
        Assert.Contains(byGame, game => game.Select(Points).Distinct().Count() > 1);
        Assert.Contains(byGame, game => game.Select(g => g.Period).Distinct().Count() > 1);
        Assert.Contains(byGame, game => game.Any(g => g.Phase == ProviderPeriodPhase.Break));
        Assert.Contains(byGame, game => game.First().Status == ProviderStatus.InProgress && game.Last().Status == ProviderStatus.Final);
    }

    [Fact]
    public void Across_60_live_games_a_score_changes_every_few_seconds()
    {
        var feed = EverySecond(Read(Busy), TimeSpan.FromMinutes(10));

        var scoredAt = new List<int>();
        for (var s = 1; s < feed.Count; s++)
        {
            var before = feed[s - 1].ToDictionary(game => game.Id, Points);
            if (feed[s].Any(game => before.TryGetValue(game.Id, out var points) && Points(game) > points))
                scoredAt.Add(s);
        }
        var gaps = scoredAt.Zip(scoredAt.Skip(1), (a, b) => b - a).Prepend(scoredAt[0]);
        Assert.True(gaps.Max() <= 15, $"the longest wait for a score was {gaps.Max()} s");
        Assert.True(scoredAt.Count >= 600 / 3, $"only {scoredAt.Count} seconds of 600 had a score");
    }

    [Fact]
    public void Scores_stay_believable_for_each_sport()
    {
        var feed = EverySecond(Read(Busy), TimeSpan.FromMinutes(30));

        var leagues = Leagues.ToDictionary(league => league.Key);
        Assert.All(feed.SelectMany(games => games), game =>
        {
            var most = MostPoints[leagues[game.LeagueKey].Sport];
            Assert.InRange(game.Home.Score ?? 0, 0, most);
            Assert.InRange(game.Away.Score ?? 0, 0, most);
        });
    }

    [Fact]
    public void Games_in_sports_without_draws_dont_finish_level()
    {
        var feed = EverySecond(Read(Busy), TimeSpan.FromMinutes(30));

        var leagues = Leagues.ToDictionary(league => league.Key);
        var finals = feed.SelectMany(games => games)
            .Where(game => game.Status == ProviderStatus.Final && leagues[game.LeagueKey].Sport != Sport.Soccer)
            .ToList();
        Assert.NotEmpty(finals);
        Assert.All(finals, game => Assert.NotEqual(game.Home.Score, game.Away.Score));
    }

    [Fact]
    public void A_final_game_drops_out_after_a_short_while_and_a_new_game_takes_its_place_at_a_venue_from_the_group()
    {
        var feed = EverySecond(Read("""{ "fill": { "count": 5, "group": "london" }, "play": "random" }"""), TimeSpan.FromMinutes(30));

        var firstFinal = feed.FindIndex(games => games.Any(game => game.Status == ProviderStatus.Final));
        Assert.True(firstFinal > 0, "a game finished");
        var finished = feed[firstFinal].First(game => game.Status == ProviderStatus.Final).Id;
        var goneAt = feed.FindIndex(games => games.All(game => game.Id != finished));
        Assert.InRange(goneAt - firstFinal, 30, 120);

        var newGame = Assert.Single(feed[goneAt], game => feed[goneAt - 1].All(before => before.Id != game.Id));
        Assert.Contains(newGame.Status, new[] { ProviderStatus.Scheduled, ProviderStatus.InProgress });
        Assert.Contains("london", Venues.Single(venue => venue.Name == newGame.Venue!.Name).Groups);
        Assert.All(feed, games => Assert.Equal(5, games.Count));
        Assert.All(feed, games => Assert.Equal(games.Count, games.Select(game => game.Venue!.Name).Distinct().Count()));
    }

    [Fact]
    public void The_number_of_live_games_stays_roughly_steady_over_10_minutes()
    {
        var feed = EverySecond(Read(Busy), TimeSpan.FromMinutes(10));

        var finished = feed.SelectMany(games => games).Where(game => game.Status == ProviderStatus.Final).Select(game => game.Id).Distinct();
        Assert.True(finished.Count() >= 10, $"only {finished.Count()} games finished");
        Assert.All(feed, games => Assert.InRange(games.Count(game => game.Status == ProviderStatus.InProgress), 48, 60));
    }

    [Fact]
    public void No_game_goes_back_from_final_or_has_a_score_that_goes_down()
    {
        var feed = EverySecond(Read(Busy), TimeSpan.FromMinutes(30));

        foreach (var game in feed.SelectMany(games => games).GroupBy(game => game.Id))
        {
            var seen = game.ToList();
            for (var i = 1; i < seen.Count; i++)
            {
                Assert.False(seen[i - 1].Status == ProviderStatus.Final && seen[i].Status != ProviderStatus.Final, $"{game.Key} went back from Final");
                Assert.True((seen[i].Home.Score ?? 0) >= (seen[i - 1].Home.Score ?? 0) && (seen[i].Away.Score ?? 0) >= (seen[i - 1].Away.Score ?? 0),
                    $"a score of {game.Key} went down");
            }
        }
    }

    [Fact]
    public void A_written_out_score_above_the_sports_usual_is_kept_not_cut_down()
    {
        var scenario = Read("""
            {
              "games": [
                {
                  "id": "goal-fest",
                  "league": "Premier League",
                  "home": { "name": "Arsenal", "abbreviation": "ARS", "score": 9 },
                  "away": { "name": "Chelsea", "abbreviation": "CHE", "score": 7 },
                  "venue": { "name": "Emirates Stadium", "city": "London" },
                  "startsIn": "-30m",
                  "status": "live"
                }
              ],
              "fill": { "count": 1, "group": "london" },
              "play": "random"
            }
            """);

        var feed = EverySecond(scenario, TimeSpan.FromMinutes(5));

        Assert.All(feed.Select(games => games.Single(g => g.Id == "goal-fest")), game => Assert.Equal((9, 7), (game.Home.Score, game.Away.Score)));
    }

    [Fact]
    public void An_upcoming_game_goes_live_at_its_start_from_nil_nil()
    {
        var scenario = Read("""{ "fill": { "count": 3, "group": "london", "mix": { "upcoming": 1 } }, "play": "random" }""");
        var play = new RandomPlayGames(scenario, StartedAt, new Random(7));
        var game = scenario.Games[0];

        Assert.Equal(ProviderStatus.Scheduled, play.GamesAt(StartedAt + game.StartsIn - TimeSpan.FromSeconds(1)).Single(g => g.Id == game.Id).Status);
        var started = play.GamesAt(StartedAt + game.StartsIn).Single(g => g.Id == game.Id);
        Assert.Equal((ProviderStatus.InProgress, 1, 0, 0), (started.Status, started.Period, started.Home.Score, started.Away.Score));
    }

    [Fact]
    public void With_the_same_seed_the_games_at_a_time_are_the_same_however_often_they_are_asked_for()
    {
        var scenario = Read(Busy);
        var everySecond = new RandomPlayGames(scenario, StartedAt, new Random(3));
        var once = new RandomPlayGames(scenario, StartedAt, new Random(3));
        var at = StartedAt + TimeSpan.FromMinutes(5);
        for (var s = 0; s < 300; s++)
            everySecond.GamesAt(StartedAt + TimeSpan.FromSeconds(s));

        Assert.Equal(everySecond.GamesAt(at).Select(Describe), once.GamesAt(at).Select(Describe));
    }

    [Theory]
    [InlineData("""{ "fill": { "count": 2, "group": "london" }, "play": "wild" }""", "play is \"wild\"", "\"random\"")]
    [InlineData("""{ "games": [], "play": "random" }""", "play is random, which needs a fill")]
    [InlineData("""{ "fill": { "count": 2, "group": "london" }, "play": "random", "timeline": { "length": "1m", "changes": [] } }""",
        "can't have a timeline as well")]
    public void Random_play_that_cant_be_used_says_why(string json, params string[] messageParts)
    {
        var error = Assert.Throws<ScenarioFileException>(() => Read(json));

        Assert.Contains("Scenario \"sample\"", error.Message);
        foreach (var part in messageParts)
            Assert.Contains(part, error.Message);
    }

    private static string Describe(ProviderGame game) =>
        $"{game.Id} {game.Status} {game.Home.Score}-{game.Away.Score} {game.Period} {game.DisplayClock} {game.Phase} {game.Venue?.Name}";

    /// <summary>The feed every second from the scenario's start, for <paramref name="length"/>.</summary>
    private static List<IReadOnlyList<ProviderGame>> EverySecond(Scenario scenario, TimeSpan length, int seed = 7)
    {
        var play = new RandomPlayGames(scenario, StartedAt, new Random(seed));
        return Enumerable.Range(0, (int)length.TotalSeconds + 1)
            .Select(s => play.GamesAt(StartedAt + TimeSpan.FromSeconds(s)))
            .ToList();
    }

    private static int Points(ProviderGame game) => (game.Home.Score ?? 0) + (game.Away.Score ?? 0);

    private Scenario Read(string json)
    {
        File.WriteAllText(Path.Combine(_folder, "sample.json"), json);
        return ScenarioReader.Read(_folder, "sample", Leagues, Venues);
    }
}
