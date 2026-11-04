using ScoreMap.Server.GameFeed;
using ScoreMap.Server.Games;
using ScoreMap.Server.Sports;

namespace ScoreMap.Server.Tests.Sports;

public sealed class RugbyScenarioTests
{
    private static readonly League League = new() { Key = "rugby/sample", Name = "Sample", Sport = Sport.Rugby };

    private static ProviderGame Match(int score) => new("same-id", League.Key, DateTimeOffset.UnixEpoch,
        new ProviderSides(new("H", "Home", null, score), new("A", "Away", null, 0)),
        ProviderStatus.InProgress, "75'", 2, null, []);

    [Fact]
    public void Scenario_detail_sessions_keep_their_own_event_history()
    {
        var first = ScenarioSports.For(League).CreateDetails();
        var second = ScenarioSports.For(League).CreateDetails();
        var scored = Assert.Single(first.Fill([Match(7)]));
        Assert.Contains(scored.KeyEvents, e => e.Kind == KeyEventKind.Try);
        Assert.Contains(scored.KeyEvents, e => e.Kind == KeyEventKind.Conversion);
        Assert.DoesNotContain(Assert.Single(second.Fill([Match(0)])).KeyEvents,
            e => e.Kind is KeyEventKind.Try or KeyEventKind.Conversion);
        var repeated = Assert.Single(first.Fill([Match(7)]));
        Assert.Equal(scored.KeyEvents, repeated.KeyEvents);
        Assert.Equal(scored.LastScore, repeated.LastScore);
    }

    [Fact]
    public void A_game_that_disappears_does_not_leave_its_scores_in_a_later_copy()
    {
        var details = ScenarioSports.For(League).CreateDetails();
        details.Fill([Match(7)]);
        details.Fill([]);
        var fresh = Assert.Single(details.Fill([Match(3)]));

        Assert.DoesNotContain(fresh.KeyEvents, e => e.Kind is KeyEventKind.Try or KeyEventKind.Conversion);
        Assert.Single(fresh.KeyEvents, e => e.Kind is KeyEventKind.PenaltyGoal or KeyEventKind.DropGoal);
        Assert.NotNull(fresh.LastScore);
    }
}
