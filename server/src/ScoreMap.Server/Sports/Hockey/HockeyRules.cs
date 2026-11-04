using ScoreMap.Server.GameFeed;
using ScoreMap.Server.Games;

namespace ScoreMap.Server.Sports;

using ScoreMap.Server.Sports.Shared;

internal sealed class HockeyRules : SportRule
{
    internal static readonly HockeyRules Instance = new();
    internal override string Name => "Hockey";
    internal override SportUsual Usual => new(3, 20);

    protected override string? ClockInPlay(ProviderGame game, League league, int period) =>
        ClockFormat.Timed(game, period, league.Regulation, "P");

    protected override bool HotSides(ProviderGame game, ProviderSides sides, int period, League league) =>
        game.Phase == ProviderPeriodPhase.Shootout || HotFinish.Timed(game, sides, period, league.Regulation, TimeSpan.FromMinutes(5), withinPoints: 1);

    internal override string? When(ProviderScoringPlay play, League league)
    {
        if (play.Period is not { } period)
            return play.Clock;
        var name = ClockFormat.PeriodName(period, league.Regulation, "P");
        return play.Clock is { } clock ? $"{name} {clock}" : name;
    }
}
