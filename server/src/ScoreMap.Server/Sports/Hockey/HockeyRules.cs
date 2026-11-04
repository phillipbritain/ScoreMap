using ScoreMap.Server.GameFeed;
using ScoreMap.Server.Games;

using ScoreMap.Server.Sports.Shared;

namespace ScoreMap.Server.Sports;

internal sealed class HockeyRules : SportRule
{
    internal static readonly HockeyRules Instance = new();
    internal override string Name => "Hockey";
    internal override SportUsual Usual { get; } = new(3, 20);

    protected override string? ClockInPlay(ProviderGame game, League league, int period) =>
        ClockFormat.Timed(game, period, league.Regulation, "P");

    protected override bool HotSides(ProviderGame game, ProviderSides sides, int period, League league) =>
        game.Phase == ProviderPeriodPhase.Shootout || HotFinish.Timed(game, sides, period, league.Regulation, TimeSpan.FromMinutes(5), withinPoints: 1);

    internal override string? When(ProviderScoringPlay play, League league) =>
        ClockFormat.WhenTimed(play, league, "P");
}
