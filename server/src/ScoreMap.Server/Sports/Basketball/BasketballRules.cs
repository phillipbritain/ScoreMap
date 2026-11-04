using ScoreMap.Server.GameFeed;
using ScoreMap.Server.Games;

using ScoreMap.Server.Sports.Shared;

namespace ScoreMap.Server.Sports;

internal sealed class BasketballRules : SportRule
{
    internal static readonly BasketballRules Instance = new();
    internal override string Name => "Basketball";
    internal override SportUsual Usual { get; } = new(4, 12);

    protected override string? ClockInPlay(ProviderGame game, League league, int period) =>
        ClockFormat.Timed(game, period, league.Regulation, ClockFormat.QuarterOrHalf(league.Regulation));

    protected override bool HotSides(ProviderGame game, ProviderSides sides, int period, League league) =>
        Clutch(game, league);

    internal override string? When(ProviderScoringPlay play, League league) =>
        ClockFormat.WhenTimed(play, league, ClockFormat.QuarterOrHalf(league.Regulation));

    private static readonly TimeSpan LastMinutes = TimeSpan.FromMinutes(5);
    private const int WithinPoints = 5;

    internal override bool Clutch(ProviderGame game, League league)
    {
        if (game.Status is not (ProviderStatus.InProgress or ProviderStatus.Delayed)
            || game.Period is not { } period
            || game.Contest is not ProviderSides { Home.Score: { } home, Away.Score: { } away }
            || Math.Abs(home - away) > WithinPoints)
            return false;

        if (period > league.Regulation)
            return true;
        return period == league.Regulation && PeriodClock.TimeLeft(game.DisplayClock) <= LastMinutes;
    }
}
