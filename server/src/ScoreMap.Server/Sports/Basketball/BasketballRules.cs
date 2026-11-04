using ScoreMap.Server.GameFeed;
using ScoreMap.Server.Games;

namespace ScoreMap.Server.Sports;

using ScoreMap.Server.Sports.Shared;

internal sealed class BasketballRules : SportRule
{
    internal static readonly BasketballRules Instance = new();
    internal override string Name => "Basketball";
    internal override SportUsual Usual => new(4, 12);

    protected override string? ClockInPlay(ProviderGame game, League league, int period) =>
        ClockFormat.Timed(game, period, league.Regulation, league.Regulation == 2 ? "H" : "Q");

    protected override bool HotSides(ProviderGame game, ProviderSides sides, int period, League league) =>
        Clutch(game, league);

    internal override string? When(ProviderScoringPlay play, League league)
    {
        if (play.Period is not { } period)
            return play.Clock;
        var name = ClockFormat.PeriodName(period, league.Regulation, league.Regulation == 2 ? "H" : "Q");
        return play.Clock is { } clock ? $"{name} {clock}" : name;
    }

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
