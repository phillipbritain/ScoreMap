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

    internal override string? When(ProviderScoringPlay play, League league) =>
        ClockFormat.WhenTimed(play, league, ClockFormat.QuarterOrHalf(league.Regulation));

    private static readonly TimeSpan LastMinutes = TimeSpan.FromMinutes(5);
    private const int WithinPoints = 5;

    /// <summary>
    /// The last 5 minutes of the last period of regulation, or any time in overtime, within 5 points:
    /// borrowed from the NBA's clutch-time stat.
    /// </summary>
    protected override bool HotSides(ProviderGame game, ProviderSides sides, int period, League league)
    {
        if (sides is not { Home.Score: { } home, Away.Score: { } away } || Math.Abs(home - away) > WithinPoints)
            return false;

        if (period > league.Regulation)
            return true;
        return period == league.Regulation && PeriodClock.TimeLeft(game.DisplayClock) <= LastMinutes;
    }
}
