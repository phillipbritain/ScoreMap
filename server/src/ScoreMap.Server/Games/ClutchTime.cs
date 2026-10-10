using ScoreMap.Server.GameFeed;

namespace ScoreMap.Server.Games;

/// <summary>
/// Whether a basketball game is in clutch time (see GLOSSARY.md): the last 5 minutes of the last period of
/// regulation, or any time in overtime, while the score is within 5 points. Borrowed from the NBA's
/// clutch-time stat. Browsers pulse a basketball score change only in clutch time, judged on the score
/// after the basket.
/// </summary>
public static class ClutchTime
{
    private static readonly TimeSpan LastMinutes = TimeSpan.FromMinutes(5);
    private const int WithinPoints = 5;

    public static bool For(ProviderGame game, League league)
    {
        if (league.Sport != Sport.Basketball
            || game.Status is not (ProviderStatus.InProgress or ProviderStatus.Delayed)
            || game.Period is not { } period
            || game.Home.Score is not { } home
            || game.Away.Score is not { } away
            || Math.Abs(home - away) > WithinPoints)
            return false;

        if (period > league.Regulation)
            return true;
        return period == league.Regulation && PeriodClock.TimeLeft(game.DisplayClock) <= LastMinutes;
    }
}
