using ScoreMap.Server.GameFeed;
using ScoreMap.Server.Games;

using ScoreMap.Server.Sports.Shared;

namespace ScoreMap.Server.Sports;

internal sealed class BaseballRules : SportRule
{
    internal static readonly BaseballRules Instance = new();
    internal override string Name => "Baseball";
    internal override SportUsual Usual { get; } = new(9, null);

    protected override string? ClockInPlay(ProviderGame game, League league, int period) =>
        ClockFormat.Innings(game, period, league.Regulation);

    protected override bool HotSides(ProviderGame game, ProviderSides sides, int period, League league) =>
        Baseball(game, sides, period, league.Regulation);

    internal override string? When(ProviderScoringPlay play, League league) => play.Period is { } period
        ? play.Phase switch
        {
            ProviderPeriodPhase.InningTop => $"Top {ClockFormat.Ordinal(period)}",
            ProviderPeriodPhase.InningBottom => $"Bot {ClockFormat.Ordinal(period)}",
            _ => ClockFormat.Ordinal(period),
        }
        : play.Clock;

    private static bool Baseball(ProviderGame game, ProviderSides sides, int inning, int regulation)
    {
        var (batting, fielding) = game.Phase switch
        {
            ProviderPeriodPhase.InningTop => (sides.Away, sides.Home),
            ProviderPeriodPhase.InningBottom => (sides.Home, sides.Away),
            _ => (null, null),
        };
        if (inning < regulation || batting?.Score is not { } runs || fielding?.Score is not { } against)
            return false;
        var situation = game.Situation;
        var runners = new[] { situation?.OnFirst, situation?.OnSecond, situation?.OnThird }.Count(on => on == true);
        return against - runs is var behind && behind >= 0 && behind <= runners + 1;
    }
}
