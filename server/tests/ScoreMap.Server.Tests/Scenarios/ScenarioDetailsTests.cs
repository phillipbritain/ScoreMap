using Microsoft.Extensions.Time.Testing;
using ScoreMap.Server.GameFeed;
using ScoreMap.Server.Games;
using ScoreMap.Server.Scenarios;

namespace ScoreMap.Server.Tests.Scenarios;

/// <summary>
/// The game panel's extra detail the scenario feed makes up for its games, watched as the poller asks for
/// each league, every 6 s on the scenario clock, while sixty games play.
/// </summary>
public sealed class ScenarioDetailsTests : IDisposable
{
    private static readonly League[] Leagues = ScenarioPlayTests.Leagues;

    private readonly string _folder = Path.Combine(Path.GetTempPath(), $"scoremap-scenario-details-{Guid.NewGuid():N}");

    public ScenarioDetailsTests() => Directory.CreateDirectory(_folder);

    public void Dispose() => Directory.Delete(_folder, recursive: true);

    /// <summary>Each league's games at each poll, every 6 s of scenario time for <paramref name="length"/>.</summary>
    private List<(League League, IReadOnlyList<ProviderGame> Games)> Watched(TimeSpan length)
    {
        File.WriteAllText(Path.Combine(_folder, "sample.json"),
            """{ "fill": { "count": 60, "group": "worldwide" }, "play": true }""");
        var scenario = ScenarioReader.Read(_folder, "sample", Leagues, ScenarioPlayTests.Venues, ScenarioPlayTests.Teams);
        var clock = new FakeTimeProvider(new DateTimeOffset(2026, 10, 4, 18, 0, 0, TimeSpan.Zero));
        var feed = new ScenarioGameFeedProvider(scenario, clock, Leagues);
        var polls = new List<(League, IReadOnlyList<ProviderGame>)>();
        for (var at = TimeSpan.Zero; at <= length; at += TimeSpan.FromSeconds(6))
        {
            foreach (var league in Leagues)
                polls.Add((league, feed.FetchScoreboardAsync(league.Key, CancellationToken.None).Result));
            clock.Advance(TimeSpan.FromSeconds(6));
        }
        return polls;
    }

    private static IEnumerable<(League League, ProviderGame Game)> Every(List<(League League, IReadOnlyList<ProviderGame> Games)> polls) =>
        polls.SelectMany(poll => poll.Games.Select(game => (poll.League, game)));

    private static int Goals(ProviderGame game) =>
        game.KeyEvents.Count(e => e.Kind is KeyEventKind.Goal or KeyEventKind.PenaltyGoal or KeyEventKind.OwnGoal);

    [Fact]
    public void Every_team_but_crickets_has_a_record_and_every_game_but_crickets_a_betting_line()
    {
        var games = Every(Watched(TimeSpan.Zero)).ToList();

        Assert.All(games.Where(g => g.League.Sport != Sport.Cricket), g =>
        {
            Assert.Matches(@"^\d+-\d+(-\d+)?$", g.Game.Home.Record);
            Assert.Matches(@"^\d+-\d+(-\d+)?$", g.Game.Away.Record);
            Assert.NotNull(g.Game.Odds?.Line);
        });
        Assert.All(games.Where(g => g.League.Sport == Sport.Cricket), g =>
            Assert.Equal((null, null, null), (g.Game.Home.Record, g.Game.Away.Record, g.Game.Odds)));
    }

    [Fact]
    public void Some_games_have_a_note_and_most_do_not()
    {
        var games = Every(Watched(TimeSpan.Zero)).Select(g => g.Game).ToList();

        // About one game in six has one: among sixty, none would take a one-in-50,000 seed.
        Assert.Contains(games, g => g.Note is not null);
        Assert.True(games.Count(g => g.Note is null) > games.Count / 2);
    }

    [Fact]
    public void Only_college_teams_are_ranked_and_only_started_games_have_a_crowd()
    {
        var games = Every(Watched(TimeSpan.Zero)).Select(g => g.Game).ToList();

        Assert.All(games.Where(g => !g.LeagueKey.Contains("college")), g => Assert.Equal((null, null), (g.Home.Rank, g.Away.Rank)));
        Assert.All(games.Where(g => g.Status == ProviderStatus.Scheduled), g => Assert.Null(g.Attendance));
        Assert.All(games.Where(g => g.Status is ProviderStatus.InProgress or ProviderStatus.Final), g => Assert.NotNull(g.Attendance));
    }

    [Fact]
    public void A_score_comes_with_a_last_score_by_the_team_whose_score_went_up_when_it_did()
    {
        var polls = Watched(TimeSpan.FromMinutes(10));

        var scores = 0;
        foreach (var byGame in Every(polls).Where(g => g.League.Sport is not (Sport.Soccer or Sport.Cricket)).GroupBy(g => g.Game.Id))
        {
            foreach (var (before, after) in byGame.Zip(byGame.Skip(1)))
            {
                var homeUp = after.Game.Home.Score > (before.Game.Home.Score ?? 0);
                var awayUp = after.Game.Away.Score > (before.Game.Away.Score ?? 0);
                if (!homeUp && !awayUp || before.Game.Status == ProviderStatus.Scheduled)
                    continue;
                scores++;
                Assert.Equal(homeUp ? after.Game.Home.Abbreviation : after.Game.Away.Abbreviation, after.Game.LastScore?.Team);
                Assert.Equal(after.Game.Period, after.Game.LastScore?.Period);
            }
        }
        Assert.True(scores > 10, $"Only {scores} scores in 10 minutes");
    }

    [Fact]
    public void Soccer_lists_a_goal_for_each_in_the_score_in_the_order_they_came_and_the_last_is_the_last_score()
    {
        var soccer = Every(Watched(TimeSpan.FromMinutes(10))).Where(g => g.League.Sport == Sport.Soccer).Select(g => g.Game)
            .Where(g => g.Status != ProviderStatus.Scheduled).ToList();

        Assert.Contains(soccer, g => Goals(g) > 0);
        Assert.All(soccer, game =>
        {
            Assert.Equal((game.Home.Score ?? 0) + (game.Away.Score ?? 0), Goals(game));
            var minutes = game.KeyEvents.Select(e => int.Parse(e.Clock!.TrimEnd('\''))).ToList();
            Assert.Equal(minutes.Order(), minutes);
            var lastGoal = game.KeyEvents.LastOrDefault(e => e.Kind is KeyEventKind.Goal or KeyEventKind.PenaltyGoal or KeyEventKind.OwnGoal);
            Assert.Equal((lastGoal?.Team, lastGoal?.Clock), (game.LastScore?.Team, game.LastScore?.Clock));
        });
    }

    [Fact]
    public void Situation_only_while_a_game_is_being_played_and_never_in_soccer_or_cricket()
    {
        var games = Every(Watched(TimeSpan.FromMinutes(2))).ToList();

        Assert.Contains(games, g => g.Game.Situation is not null);
        Assert.All(games.Where(g => g.Game.Situation is not null), g =>
        {
            Assert.Equal((ProviderStatus.InProgress, false), (g.Game.Status, g.Game.Phase == ProviderPeriodPhase.Break));
            Assert.False(g.League.Sport is Sport.Soccer or Sport.Cricket);
        });
    }

    [Fact]
    public void Cricket_has_no_last_score()
    {
        var cricket = Every(Watched(TimeSpan.FromMinutes(5))).Where(g => g.League.Sport == Sport.Cricket).ToList();

        Assert.All(cricket, g => Assert.Null(g.Game.LastScore));
    }
}
