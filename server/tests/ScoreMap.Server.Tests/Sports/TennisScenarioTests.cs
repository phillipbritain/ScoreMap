using ScoreMap.Server.GameFeed;
using ScoreMap.Server.Games;
using ScoreMap.Server.Scenarios;
using ScoreMap.Server.Sports;
using ScoreMap.Server.Tests.Scenarios;
using ScoreMap.Server.Tests.Support;

namespace ScoreMap.Server.Tests.Sports;

/// <summary>
/// A tennis match written into a scenario looks like a live one: its progress and scoreline come from
/// its sets, with no game clock, and it has none of another sport's made-up record, odds, crowd or last score.
/// </summary>
public sealed class TennisScenarioTests : IDisposable
{
    private static readonly League Atp = new() { Key = "tennis/atp", Name = "ATP", Sport = Sport.Tennis, PlannedLength = TimeSpan.FromMinutes(150) };

    private static readonly League Nhl = new() { Key = "hockey/nhl", Name = "NHL", Sport = Sport.Hockey, PlannedLength = TimeSpan.FromMinutes(150) };

    private static readonly ScenarioTeamList NhlTeams = new(new Dictionary<string, IReadOnlyList<ScenarioTeam>>
    {
        ["NHL"] = Enumerable.Range(1, 4).Select(n => new ScenarioTeam($"NHL team {n}", $"T{n}", null)).ToList(),
    });

    private static readonly DateTimeOffset StartedAt = new(2026, 10, 4, 18, 0, 0, TimeSpan.Zero);

    private readonly string _folder = Path.Combine(Path.GetTempPath(), $"scoremap-tennis-scenario-{Guid.NewGuid():N}");

    public TennisScenarioTests() => Directory.CreateDirectory(_folder);

    public void Dispose() => Directory.Delete(_folder, recursive: true);

    /// <summary>A Live ATP match between J. Sinner (home), a set up, and C. Alcaraz (away), in the 2nd set; under play if <paramref name="play"/>.</summary>
    private static string SinnerAlcaraz(bool play) => $$"""
        {
          "games": [ { "id": "sinner-alcaraz", "league": "ATP",
                       "home": { "name": "Jannik Sinner", "abbreviation": "J. Sinner", "score": 1 },
                       "away": { "name": "Carlos Alcaraz", "abbreviation": "C. Alcaraz", "score": 0 },
                       "venue": { "name": "Centre Court", "city": "Somewhere", "notInVenueList": true },
                       "startsIn": "-1h", "status": "live", "period": 2 } ]{{(play ? Play : "")}}
        }
        """;

    // Play needs a fill for the games it brings on: one game beside the match, never Disrupted.
    private const string Play = """, "fill": { "count": 1, "group": "london" }, "play": true, "disrupted": 0""";

    private static async Task<Game> ReceivedAsync(string scenario)
    {
        await using var server = new ScoreMapServer { Scenario = "test" };
        server.WriteScenario("test", scenario);
        await using var client = await server.ConnectClientAsync();
        return Assert.Single(await client.NextSnapshotAsync(), game => game.Id == "sinner-alcaraz");
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task A_written_match_has_no_made_up_record_odds_crowd_or_last_score(bool play)
    {
        var match = await ReceivedAsync(SinnerAlcaraz(play));

        Assert.Equal((null, null), (match.Sides().Home.Record, match.Sides().Away.Record));
        Assert.Null(match.Odds);
        Assert.Null(match.Attendance);
        Assert.Null(match.LastScore);
        Assert.Empty(match.KeyEvents);
    }

    [Fact]
    public async Task A_match_under_play_shows_its_sets_as_a_live_match_does()
    {
        var match = await ReceivedAsync(SinnerAlcaraz(play: true));

        // The set Sinner won is made up; the 2nd is just starting.
        Assert.Equal("2nd set · 0–0", match.Clock);
        var scoreline = Assert.IsType<GameScoreline>(match.Scoreline);
        Assert.Equal(["1st", "2nd"], scoreline.Sets.Select(set => set.Name));
        Assert.Equal("J. Sinner", scoreline.Sets[0].Winner);
        Assert.Matches(@"^(6-[0-4]|7-5|7-6\(\d\))$", scoreline.Sets[0].Score);
        Assert.Equal(("0-0", null), (scoreline.Sets[1].Score, scoreline.Sets[1].Winner));
        Assert.Equal(("1", "0"), (match.Sides().Home.Score, match.Sides().Away.Score));
    }

    [Fact]
    public void A_note_names_a_round_of_the_draw()
    {
        var details = ScenarioSports.For(Atp).CreateDetails();
        var matches = Enumerable.Range(1, 120).Select(n => new ProviderGame($"match-{n}", Atp.Key, StartedAt,
            new ProviderSides(new("H", "Home", null, null), new("A", "Away", null, null)), ProviderStatus.Scheduled, null, null, null, []));

        var notes = details.Fill(matches.ToList()).Select(match => match.Note).OfType<string>().ToList();

        Assert.NotEmpty(notes);
        Assert.All(notes, note => Assert.Contains(note, new[] { "R1", "R2", "R3", "R16", "QF", "SF", "Final" }));
    }

    [Theory]
    [InlineData(1)]
    [InlineData(2)]
    [InlineData(3)]
    [InlineData(4)]
    [InlineData(5)]
    public void Under_play_a_match_goes_set_by_set_with_no_clock_and_ends_when_a_player_wins_two_sets(int seed)
    {
        File.WriteAllText(Path.Combine(_folder, "sample.json"), SinnerAlcaraz(play: true));
        var scenario = ScenarioReader.Read(_folder, "sample", [Atp, Nhl], ScenarioPlayTests.Venues, NhlTeams);
        var play = new ScenarioPlay(scenario, StartedAt, new Random(seed));

        var seen = Enumerable.Range(0, (int)TimeSpan.FromHours(6).TotalSeconds / 6)
            .Select(s => play.GamesAt(StartedAt + TimeSpan.FromSeconds(6 * s)).SingleOrDefault(game => game.Id == "sinner-alcaraz"))
            // Until it drops out, a minute after it finishes.
            .TakeWhile(match => match is not null)
            .OfType<ProviderGame>()
            .ToList();

        Assert.All(seen, match =>
        {
            Assert.Null(match.DisplayClock);
            Assert.NotEmpty(match.Sets);
            Assert.Equal(match.Sets.Count, match.Period);
            Assert.Equal(match.Sets.Count(set => set.HomeWon == true), match.Sides().Home.Score);
            Assert.Equal(match.Sets.Count(set => set.HomeWon == false), match.Sides().Away.Score);
            Assert.All(match.Sets.Where(set => set.HomeWon is not null), set =>
                Assert.Matches(@"^(6-[0-4]|7-5|7-6)$", $"{Math.Max(set.Home, set.Away)}-{Math.Min(set.Home, set.Away)}"));
        });
        Assert.Contains(seen, match => match.Sets.Sum(set => set.Home + set.Away) > 5);
        var final = seen.First(match => match.Status == ProviderStatus.Final);
        Assert.Contains(2, new[] { final.Sides().Home.Score, final.Sides().Away.Score });
        Assert.InRange(final.Sides().Home.Score!.Value + final.Sides().Away.Score!.Value, 2, 3);
        Assert.All(final.Sets, set => Assert.NotNull(set.HomeWon));
    }
}
