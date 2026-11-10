using Microsoft.Extensions.Time.Testing;
using ScoreMap.Server.GameFeed;
using ScoreMap.Server.Games;
using ScoreMap.Server.Scenarios;
using ScoreMap.Server.Sports;
using ScoreMap.Server.Tests.Scenarios;
using ScoreMap.Server.Tests.Support;

namespace ScoreMap.Server.Tests.Sports;

/// <summary>
/// A tennis match written into a scenario looks like a live one: its progress and scoreline come from
/// its sets, with no game clock, and it has none of another sport's made-up record or last score.
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

    // Play needs a fill for the games it brings on: one game beside the match.
    private const string Play = """, "fill": { "count": 1, "group": "london" }, "play": true""";

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
    public async Task A_written_match_has_no_made_up_record_or_last_score(bool play)
    {
        var match = await ReceivedAsync(SinnerAlcaraz(play));

        Assert.Equal((null, null), (match.Sides().Home.Record, match.Sides().Away.Record));
        Assert.Null(match.LastScore);
        Assert.Empty(match.KeyEvents);
    }

    private const string WrittenSets = """
        , "sets": [ { "home": 7, "away": 6, "homeTiebreak": 7, "awayTiebreak": 4, "homeWon": true },
                    { "home": 2, "away": 3 } ]
        """;

    [Fact]
    public async Task A_standing_live_match_delivers_its_written_sets()
    {
        var match = await ReceivedAsync(SinnerAlcaraz(false).Replace("\"period\": 2", "\"period\": 2" + WrittenSets));

        Assert.Equal("2nd set · 2–3", match.Clock);
        var scoreline = Assert.IsType<GameScoreline>(match.Scoreline);
        Assert.Equal([new GameSet("1st", "7-6(4)", "J. Sinner"), new GameSet("2nd", "2-3", null)], scoreline.Sets);
    }

    [Theory]
    [InlineData("retired", "ret.", "Ret.")]
    [InlineData("walkover", "W/O", "W/O")]
    public async Task A_final_match_delivers_its_written_early_ending(string reason, string ending, string clock)
    {
        var written = SinnerAlcaraz(false).Replace("\"status\": \"live\"", "\"status\": \"final\"")
            .Replace("\"period\": 2", "\"period\": 2" + (reason == "retired" ? WrittenSets : "")
                + $$""", "earlyEnding": { "reason": "{{reason}}", "winner": "C. Alcaraz" }""");
        var match = await ReceivedAsync(written);

        var scoreline = Assert.IsType<GameScoreline>(match.Scoreline);
        Assert.Equal((ending, "C. Alcaraz"), (scoreline.Ending, scoreline.Advanced));
        Assert.Equal(clock, match.Clock);
        Assert.Equal(reason == "retired" ? 2 : 0, scoreline.Sets.Count);
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task Written_sets_supply_the_score_and_current_set_when_play_begins_or_stands_still(bool play)
    {
        var written = SinnerAlcaraz(play).Replace("\"score\": 1", "\"score\": 0")
            .Replace("\"period\": 2", "\"period\": 1" + WrittenSets);
        var match = await ReceivedAsync(written);

        Assert.Equal(("1", "0"), (match.Sides().Home.Score, match.Sides().Away.Score));
        Assert.Equal("2nd set · 2–3", match.Clock);
        Assert.Equal(["7-6(4)", "2-3"], Assert.IsType<GameScoreline>(match.Scoreline).Sets.Select(set => set.Score));
    }

    [Fact]
    public async Task A_timeline_replaces_the_written_sets_and_can_end_in_retirement()
    {
        var written = SinnerAlcaraz(false).Replace("\"period\": 2", "\"period\": 2" + WrittenSets)
            .TrimEnd().TrimEnd('}') + """
            , "timeline": { "length": "1m", "changes": [
              { "at": "10s", "game": "sinner-alcaraz", "status": "final",
                "sets": [ { "home": 7, "away": 6, "homeTiebreak": 7, "awayTiebreak": 4, "homeWon": true },
                          { "home": 2, "away": 4 } ],
                "earlyEnding": { "reason": "retired", "winner": "J. Sinner" } }
            ] } }
            """;
        File.WriteAllText(Path.Combine(_folder, "sample.json"), written);
        var scenario = ScenarioReader.Read(_folder, "sample", [Atp], []);
        var clock = new FakeTimeProvider(StartedAt);
        var feed = new ScenarioGameFeedProvider(scenario, clock, [Atp]);

        var before = Assert.Single(await feed.FetchScoreboardAsync(Atp.Key, default));
        Assert.Equal(new ProviderSet(2, 3), before.Sets[1]);
        clock.Advance(TimeSpan.FromSeconds(10));
        var after = Assert.Single(await feed.FetchScoreboardAsync(Atp.Key, default));
        Assert.Equal(ProviderStatus.Final, after.Status);
        Assert.Equal([new ProviderSet(7, 6, 7, 4, true), new ProviderSet(2, 4)], after.Sets);
        Assert.Equal(new ProviderEarlyEnding(EarlyEndingReason.Retired, "J. Sinner"), after.EarlyEnding);
        clock.Advance(TimeSpan.FromSeconds(50));
        var loop = Assert.Single(await feed.FetchScoreboardAsync(Atp.Key, default));
        Assert.Equal("sinner-alcaraz-loop2", loop.Id);
        Assert.Equal(before.Sets, loop.Sets);
        Assert.Null(loop.EarlyEnding);
    }

    [Fact]
    public async Task Play_begins_the_next_set_without_replacing_a_written_completed_set()
    {
        var written = SinnerAlcaraz(true).Replace("\"period\": 2", """
            "period": 1, "sets": [ { "home": 6, "away": 4, "homeWon": true } ]
            """);
        var match = await ReceivedAsync(written);

        Assert.Equal("2nd set · 0–0", match.Clock);
        Assert.Equal([new GameSet("1st", "6-4", "J. Sinner"), new GameSet("2nd", "0-0", null)],
            Assert.IsType<GameScoreline>(match.Scoreline).Sets);
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task An_upcoming_match_has_no_made_up_score_or_sets(bool play)
    {
        var written = SinnerAlcaraz(play).Replace("\"status\": \"live\"", "\"status\": \"upcoming\"")
            .Replace("\"startsIn\": \"-1h\"", "\"startsIn\": \"20m\"")
            .Replace("\"score\": 1", "\"score\": null").Replace("\"score\": 0", "\"score\": null")
            .Replace(", \"period\": 2", "");
        var match = await ReceivedAsync(written);

        Assert.Equal((null, null), (match.Sides().Home.Score, match.Sides().Away.Score));
        Assert.Null(match.Scoreline);
        Assert.Null(match.Clock);
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task A_final_match_keeps_just_its_completed_written_sets(bool play)
    {
        var written = SinnerAlcaraz(play).Replace("\"status\": \"live\"", "\"status\": \"final\"")
            .Replace("\"period\": 2", """
                "period": 2, "sets": [ { "home": 6, "away": 4, "homeWon": true },
                                       { "home": 7, "away": 5, "homeWon": true } ]
                """);
        var match = await ReceivedAsync(written);

        Assert.Equal("Final", match.Clock);
        Assert.Equal(("2", "0"), (match.Sides().Home.Score, match.Sides().Away.Score));
        Assert.Equal([new GameSet("1st", "6-4", "J. Sinner"), new GameSet("2nd", "7-5", "J. Sinner")],
            Assert.IsType<GameScoreline>(match.Scoreline).Sets);
    }

    [Fact]
    public async Task A_suspended_match_keeps_its_last_written_set_without_starting_another()
    {
        var written = SinnerAlcaraz(true).Replace("\"status\": \"live\"", "\"status\": \"suspended\"")
            .Replace("\"period\": 2", """
                "period": 1, "sets": [ { "home": 6, "away": 4, "homeWon": true } ]
                """);
        // A suspended match isn't shown (ADR-0021), so this is the feed's: as play would take it on.
        File.WriteAllText(Path.Combine(_folder, "sample.json"), written);
        var scenario = ScenarioReader.Read(_folder, "sample", [Atp, Nhl], ScenarioPlayTests.Venues, NhlTeams);
        var clock = new FakeTimeProvider(StartedAt);
        var feed = new ScenarioGameFeedProvider(scenario, clock, [Atp, Nhl]);
        clock.Advance(TimeSpan.FromMinutes(30));

        var match = Assert.Single(await feed.FetchScoreboardAsync(Atp.Key, default));

        Assert.Equal(ProviderStatus.Suspended, match.Status);
        var set = Assert.Single(match.Sets);
        Assert.Equal((6, 4), (set.Home, set.Away));
    }

    [Fact]
    public async Task Playing_forward_keeps_the_completed_written_sets()
    {
        File.WriteAllText(Path.Combine(_folder, "sample.json"),
            SinnerAlcaraz(true).Replace("\"period\": 2", "\"period\": 2" + WrittenSets));
        var scenario = ScenarioReader.Read(_folder, "sample", [Atp, Nhl], ScenarioPlayTests.Venues, NhlTeams);
        var clock = new FakeTimeProvider(StartedAt);
        var feed = new ScenarioGameFeedProvider(scenario, clock, [Atp, Nhl]);
        clock.Advance(TimeSpan.FromMinutes(30));

        var match = Assert.Single(await feed.FetchScoreboardAsync(Atp.Key, default));

        Assert.Equal(new ProviderSet(7, 6, 7, 4, true), match.Sets[0]);
        Assert.True(match.Sets.Sum(set => set.Home + set.Away) > 18);
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

    [Fact]
    public void A_made_up_live_match_under_play_shows_its_sets()
    {
        var teams = new ScenarioTeamList(new Dictionary<string, IReadOnlyList<ScenarioTeam>>
        {
            ["ATP"] = [new("Jannik Sinner", "J. Sinner", null), new("Carlos Alcaraz", "C. Alcaraz", null)],
        });
        var maker = new ScenarioGameMaker([Atp], teams);
        var venue = ScenarioPlayTests.Venues[0];
        var made = maker.Make("made", venue, GameStatus.Live, [], new Random(1));
        var play = new ScenarioPlay(new Scenario("sample", [made],
            Play: new PlaySettings([Atp], [venue], maker)), StartedAt, new Random(1));

        var match = Assert.Single(play.GamesAt(StartedAt));

        Assert.Null(match.DisplayClock);
        Assert.NotEmpty(match.Sets);
        Assert.Equal(match.Sets.Count, match.Period);
        Assert.Equal(match.Sets.Count(set => set.HomeWon == true), match.Sides().Home.Score);
        Assert.Equal(match.Sets.Count(set => set.HomeWon == false), match.Sides().Away.Score);
    }
}
