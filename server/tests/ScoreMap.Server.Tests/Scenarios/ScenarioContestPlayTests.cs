using ScoreMap.Server.GameFeed;
using ScoreMap.Server.Games;
using ScoreMap.Server.Scenarios;

namespace ScoreMap.Server.Tests.Scenarios;

public sealed class ScenarioContestPlayTests
{
    private static readonly DateTimeOffset Start = DateTimeOffset.Parse("2026-08-04T16:00:00Z");

    private static ScenarioPlay Play(ProviderContest contest, Sport sport, int? period = null, ProviderPeriodPhase phase = ProviderPeriodPhase.Playing)
    {
        var league = new League { Key = "sample", Name = "Sample", Sport = sport, PlannedLength = TimeSpan.FromMinutes(10) };
        var game = new ScenarioGame("sample", league.Key, TimeSpan.Zero, contest,
            new ProviderVenue("Venue", "City", null, "USA"), ProviderStatus.InProgress, null, period, phase);
        var settings = new PlaySettings([league], [], new ScenarioGameMaker([league], new ScenarioTeamList(
            new Dictionary<string, IReadOnlyList<ScenarioTeam>>())), 0, new HashSet<string> { game.Id });
        return new ScenarioPlay(new Scenario("sample", [game], Play: settings), Start, new Random(1));
    }

    [Fact]
    public void Written_golf_break_stays_between_rounds()
    {
        var play = Play(new ProviderField([new(1, "Scottie Scheffler", "S. Scheffler", null, -10, 18)]),
            Sport.Golf, 2, ProviderPeriodPhase.Break);
        var game = Assert.Single(play.GamesAt(Start.AddSeconds(1)));
        Assert.Equal(2, game.Period);
        Assert.Equal(ProviderPeriodPhase.Break, game.Phase);
    }

    [Fact]
    public void Timeline_can_change_a_fields_order_and_scores()
    {
        var folder = Path.Combine(Path.GetTempPath(), $"scoremap-field-timeline-{Guid.NewGuid():N}");
        Directory.CreateDirectory(folder);
        try
        {
            File.WriteAllText(Path.Combine(folder, "sample.json"), """
                { "games": [{ "id": "golf", "league": "PGA", "status": "live", "startsIn": "-1h",
                  "venue": { "name": "Course", "city": "City" },
                  "field": [{ "name": "Scottie Scheffler", "shortName": "S. Scheffler", "score": -10 },
                            { "name": "Rory McIlroy", "shortName": "R. McIlroy", "score": -9 }] }],
                  "timeline": { "length": "10m", "changes": [{ "at": "1m", "game": "golf", "field": [
                    { "name": "Rory McIlroy", "shortName": "R. McIlroy", "score": -11 },
                    { "name": "Scottie Scheffler", "shortName": "S. Scheffler", "score": -10 }] }] } }
                """);
            var scenario = ScenarioReader.Read(folder, "sample", [new League { Key = "golf/pga", Name = "PGA", Sport = Sport.Golf }],
                [new ScenarioVenue("Course", "City", null, "USA", [])]);
            var game = Assert.Single(scenario.GamesAt(Start, Start.AddMinutes(1)));
            var leader = Assert.IsType<ProviderField>(game.Contest).Entries[0];
            Assert.Equal("Rory McIlroy", leader.Name);
            Assert.Equal(-11, leader.ToPar);
            Assert.Equal(1, leader.Position);
        }
        finally { Directory.Delete(folder, recursive: true); }
    }

    [Fact]
    public void Race_keeps_its_written_lap_and_finishes_then_restarts_as_a_new_game()
    {
        var play = Play(new ProviderField([new(1, "Kyle Larson", "K. Larson", null),
            new(2, "Chase Elliott", "C. Elliott", null)]), Sport.Racing, 199);
        Assert.Equal(199, Assert.Single(play.GamesAt(Start.AddSeconds(1))).Period);
        var final = Assert.Single(play.GamesAt(Start.AddSeconds(10)));
        Assert.Equal(ProviderStatus.Final, final.Status);
        Assert.Equal(200, final.Period);
        var next = Assert.Single(play.GamesAt(Start.AddSeconds(100)));
        Assert.NotEqual(final.Id, next.Id);
        Assert.IsType<ProviderField>(next.Contest);
        Assert.Equal(ProviderStatus.InProgress, next.Status);
    }

    [Fact]
    public void Golf_finishes_at_the_final_hole()
    {
        var play = Play(new ProviderField([new(1, "Scottie Scheffler", "S. Scheffler", null, -15, 17),
            new(2, "Rory McIlroy", "R. McIlroy", null, -14, 17)]), Sport.Golf, 4);
        var game = Assert.Single(play.GamesAt(Start.AddSeconds(5)));
        Assert.Equal(ProviderStatus.Final, game.Status);
        Assert.All(Assert.IsType<ProviderField>(game.Contest).Entries, e => Assert.Equal(18, e.Thru));
    }

    [Fact]
    public void Main_event_finishes_with_a_winner_and_method()
    {
        var bout = new ProviderBout("main", new("Jon Jones", "J. Jones", null, null),
            new("Stipe Miocic", "S. Miocic", null, null), "Heavyweight", 5, ProviderStatus.InProgress, 5, "4:59");
        var play = Play(new ProviderBouts([bout]), Sport.Mma);
        var game = Assert.Single(play.GamesAt(Start.AddSeconds(1)));
        Assert.Equal(ProviderStatus.Final, game.Status);
        var result = Assert.Single(Assert.IsType<ProviderBouts>(game.Contest).Bouts);
        Assert.Equal(BoutMethod.Decision, result.Method);
        Assert.NotEqual(result.First.Winner, result.Second.Winner);
    }
}
