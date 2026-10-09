using ScoreMap.Server.GameFeed;
using ScoreMap.Server.Games;
using ScoreMap.Server.Scenarios;

namespace ScoreMap.Server.Tests.Scenarios;

/// <summary>
/// Random play (<c>"play": "random"</c>), read from a scenario file and played from the scenario's
/// start with a fixed random seed. Most tests watch it as a browser does at 6× (the feed every second
/// of real time, so every 6 s on the scenario clock), where a busy globe has a score every few seconds
/// and games finish (and new ones arrive) every few minutes.
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
        var feed = Watched(Read(Busy), TimeSpan.FromMinutes(10));

        var byGame = feed.SelectMany(games => games).GroupBy(game => game.Id).ToList();
        Assert.Contains(byGame, game => game.Select(Points).Distinct().Count() > 1);
        Assert.Contains(byGame, game => game.Select(g => g.Period).Distinct().Count() > 1);
        Assert.Contains(byGame, game => game.Any(g => g.Phase == ProviderPeriodPhase.Break));
        Assert.Contains(byGame, game => game.First().Status == ProviderStatus.InProgress && game.Last().Status == ProviderStatus.Final);
    }

    [Fact]
    public void Across_60_live_games_a_score_changes_every_few_seconds()
    {
        var feed = Watched(Read(Busy), TimeSpan.FromMinutes(10));

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
        var feed = Watched(Read(Busy), TimeSpan.FromMinutes(30));

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
        var feed = Watched(Read(Busy), TimeSpan.FromMinutes(30));

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
        // At 1×, so the feed is every second of scenario time.
        var feed = Watched(Read("""{ "fill": { "count": 5, "group": "london" }, "play": "random" }"""), TimeSpan.FromHours(3), speed: 1);

        var firstFinal = feed.FindIndex(games => games.Any(game => game.Status == ProviderStatus.Final));
        Assert.True(firstFinal > 0, "a game finished");
        var finished = feed[firstFinal].First(game => game.Status == ProviderStatus.Final).Id;
        var goneAt = feed.FindIndex(games => games.All(game => game.Id != finished));
        Assert.Equal(RandomPlay.FinalStays, TimeSpan.FromSeconds(goneAt - firstFinal));

        var newGame = Assert.Single(feed[goneAt], game => feed[goneAt - 1].All(before => before.Id != game.Id));
        Assert.Contains(newGame.Status, new[] { ProviderStatus.Scheduled, ProviderStatus.InProgress });
        Assert.Contains("london", Venues.Single(venue => venue.Name == newGame.Venue!.Name).Groups);
        Assert.All(feed, games => Assert.Equal(5, games.Count));
        Assert.All(feed, games => Assert.Equal(games.Count, games.Select(game => game.Venue!.Name).Distinct().Count()));
    }

    [Fact]
    public void The_number_of_live_games_stays_roughly_steady_over_10_minutes()
    {
        var feed = Watched(Read(Busy), TimeSpan.FromMinutes(10));

        var finished = feed.SelectMany(games => games).Where(game => game.Status == ProviderStatus.Final).Select(game => game.Id).Distinct();
        Assert.True(finished.Count() >= 10, $"only {finished.Count()} games finished");
        Assert.All(feed, games => Assert.InRange(games.Count(game => game.Status == ProviderStatus.InProgress), 48, 60));
    }

    [Fact]
    public void No_game_goes_back_from_final_or_has_a_score_that_goes_down()
    {
        var feed = Watched(Read(Busy), TimeSpan.FromMinutes(30));

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
                  "venue": { "name": "Stadium 50", "city": "City 50" },
                  "startsIn": "-30m",
                  "status": "live"
                }
              ],
              "fill": { "count": 1, "group": "london" },
              "play": "random"
            }
            """);

        var feed = Watched(scenario, TimeSpan.FromMinutes(5));

        Assert.All(feed.Select(games => games.Single(g => g.Id == "goal-fest")), game => Assert.Equal((9, 7), (game.Home.Score, game.Away.Score)));
    }

    [Fact]
    public void An_upcoming_game_goes_live_at_its_start_from_nil_nil()
    {
        var scenario = Read("""{ "fill": { "count": 3, "group": "london", "mix": { "upcoming": 1 } }, "play": "random" }""");
        var play = new RandomPlay(scenario, StartedAt, new Random(7));
        var game = scenario.Games[0];

        Assert.Equal(ProviderStatus.Scheduled, play.GamesAt(StartedAt + game.StartsIn - TimeSpan.FromSeconds(1)).Single(g => g.Id == game.Id).Status);
        var started = play.GamesAt(StartedAt + game.StartsIn).Single(g => g.Id == game.Id);
        Assert.Equal((ProviderStatus.InProgress, 1, 0, 0), (started.Status, started.Period, started.Home.Score, started.Away.Score));
    }

    [Fact]
    public void With_the_same_seed_the_games_at_a_time_are_the_same_however_often_they_are_asked_for()
    {
        var scenario = Read(Busy);
        var everySecond = new RandomPlay(scenario, StartedAt, new Random(3));
        var once = new RandomPlay(scenario, StartedAt, new Random(3));
        var at = StartedAt + TimeSpan.FromMinutes(5);
        for (var s = 0; s < 300; s++)
            everySecond.GamesAt(StartedAt + TimeSpan.FromSeconds(s));

        Assert.Equal(everySecond.GamesAt(at).Select(Describe), once.GamesAt(at).Select(Describe));
    }

    [Fact]
    public void With_the_same_seed_the_games_at_a_time_are_the_same_whatever_speed_changes_were_made()
    {
        var scenario = Read(Busy);
        var atOneSpeed = new RandomPlay(scenario, StartedAt, new Random(3));
        var changingSpeed = new RandomPlay(scenario, StartedAt, new Random(3));
        var at = StartedAt + TimeSpan.FromMinutes(30);
        // Fetched every 250 ms of real time at 1×, then 16×, then 64×, then 2×.
        var reading = StartedAt;
        foreach (var (speed, fetches) in new[] { (1, 400), (16, 100), (64, 50), (2, 200) })
            for (var i = 0; i < fetches && reading < at; i++)
            {
                reading += TimeSpan.FromMilliseconds(250) * speed;
                changingSpeed.GamesAt(reading);
            }
        for (var s = 1; s <= (at - StartedAt).TotalSeconds; s++)
            atOneSpeed.GamesAt(StartedAt + TimeSpan.FromSeconds(s));

        Assert.Equal(atOneSpeed.GamesAt(at).Select(Describe), changingSpeed.GamesAt(at).Select(Describe));
    }

    // Live play: written-out games beside each other in every status that live play leaves alone.
    private const string LivePlay = """
        {
          "games": [
            { "id": "live", "league": "Premier League", "home": { "name": "Arsenal", "abbreviation": "ARS", "score": 1 },
              "away": { "name": "Chelsea", "abbreviation": "CHE", "score": 0 }, "venue": { "name": "Stadium 1", "city": "City 1" },
              "startsIn": "-30m", "status": "live" },
            { "id": "upcoming", "league": "NBA", "home": { "name": "Knicks", "abbreviation": "NY" }, "away": { "name": "Celtics", "abbreviation": "BOS" },
              "venue": { "name": "Stadium 2", "city": "City 2" }, "startsIn": "5m", "status": "upcoming" },
            { "id": "final", "league": "NHL", "home": { "name": "Leafs", "abbreviation": "TOR", "score": 3 },
              "away": { "name": "Canadiens", "abbreviation": "MTL", "score": 2 }, "venue": { "name": "Stadium 3", "city": "City 3" },
              "startsIn": "-3h", "status": "final" },
            { "id": "postponed", "league": "MLB", "home": { "name": "Yankees", "abbreviation": "NYY" }, "away": { "name": "Red Sox", "abbreviation": "BOS" },
              "venue": { "name": "Stadium 4", "city": "City 4" }, "startsIn": "45m", "status": "postponed" }
          ],
          "play": "live"
        }
        """;

    [Fact]
    public void Live_play_moves_live_games_on_and_leaves_every_other_game_as_it_is()
    {
        var feed = Watched(Read(LivePlay), TimeSpan.FromMinutes(10));

        var live = feed.Select(games => games.Single(game => game.Id == "live")).ToList();
        Assert.All(live, game => Assert.Equal(ProviderStatus.InProgress, game.Status));
        Assert.True(live.Select(game => game.DisplayClock).Distinct().Count() > 30, "the clock runs");
        Assert.True(live.Select(Points).Distinct().Count() > 1, "the game scores");
        foreach (var id in new[] { "upcoming", "final", "postponed" })
            Assert.Single(feed.Select(games => Describe(games.Single(game => game.Id == id))).Distinct());
        Assert.All(feed, games => Assert.Equal(4, games.Count));
    }

    [Theory]
    [InlineData("Premier League", "63'", 2, "64'")]
    [InlineData("NHL", "9:40", 2, "9:3")]
    [InlineData("NBA", "5:10", 2, "5:0")]
    public void A_written_out_live_game_plays_on_from_its_written_period_and_clock(string league, string clock, int period, string soon)
    {
        // Started long enough ago to be at halftime by its start time alone: the written clock wins.
        // Watched for two minutes, as at 1× soccer's clock moves on a minute in about one and a half.
        var scenario = Read($$"""
            {
              "games": [
                { "id": "live", "league": "{{league}}", "home": { "name": "Home", "abbreviation": "HOM" }, "away": { "name": "Away", "abbreviation": "AWY" },
                  "venue": { "name": "Stadium 1", "city": "City 1" }, "startsIn": "-1h5m", "status": "live", "clock": "{{clock}}", "period": {{period}} }
              ],
              "play": "live"
            }
            """);

        var feed = Watched(scenario, TimeSpan.FromMinutes(2), speed: 1);

        Assert.Equal((period, clock), (feed[0][0].Period, feed[0][0].DisplayClock));
        Assert.Contains(feed, games => games[0].DisplayClock!.StartsWith(soon) && games[0].Period == period);
    }

    [Fact]
    public void Under_live_play_a_game_at_the_end_starts_over_as_a_new_game_rather_than_finishing()
    {
        // Two and a half hours in: nearly through a 2-hour game, so it reaches the end within minutes.
        var scenario = Read(LivePlay.Replace("\"-30m\"", "\"-2h30m\""));

        var feed = Watched(scenario, TimeSpan.FromMinutes(5), speed: 16);

        var startedOver = feed.FindIndex(games => games.All(game => game.Id != "live"));
        Assert.True(startedOver > 0, "the game started over");
        Assert.All(feed.Take(startedOver), games => Assert.Equal(ProviderStatus.InProgress, games.Single(game => game.Id == "live").Status));
        var again = feed[startedOver].Single(game => game.Id == "live-loop2");
        Assert.Equal((ProviderStatus.InProgress, 1, 0, 0), (again.Status, again.Period, again.Home.Score, again.Away.Score));
        Assert.Equal(("Arsenal", "Chelsea", "Stadium 1"), (again.Home.FullName, again.Away.FullName, again.Venue!.Name));
        Assert.Equal(StartedAt + TimeSpan.FromSeconds(startedOver) * 16, again.StartTime, TimeSpan.FromSeconds(16));
        Assert.All(feed, games => Assert.Equal(4, games.Count));
    }

    [Theory]
    [InlineData("""{ "fill": { "count": 2, "group": "london" }, "play": "wild" }""", "play is \"wild\"", "\"random\"", "\"live\"")]
    [InlineData("""{ "fill": { "count": 2, "group": "london" }, "play": "live", "timeline": { "length": "1m", "changes": [] } }""",
        "can't have a timeline as well")]
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

    /// <summary>
    /// The feed every second of real time from the scenario's start, for <paramref name="length"/> of real
    /// time, with the scenario clock at <paramref name="speed"/>.
    /// </summary>
    private static List<IReadOnlyList<ProviderGame>> Watched(Scenario scenario, TimeSpan length, int speed = 6, int seed = 7)
    {
        var play = new RandomPlay(scenario, StartedAt, new Random(seed));
        return Enumerable.Range(0, (int)length.TotalSeconds + 1)
            .Select(s => play.GamesAt(StartedAt + TimeSpan.FromSeconds(s) * speed))
            .ToList();
    }

    private static int Points(ProviderGame game) => (game.Home.Score ?? 0) + (game.Away.Score ?? 0);

    private Scenario Read(string json)
    {
        File.WriteAllText(Path.Combine(_folder, "sample.json"), json);
        return ScenarioReader.Read(_folder, "sample", Leagues, Venues);
    }
}
