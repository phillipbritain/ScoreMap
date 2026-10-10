using System.Globalization;
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
        return period == league.Regulation && Left(game.DisplayClock) is { } left && left <= LastMinutes;
    }

    /// <summary>
    /// The time left in the period from the provider's clock: "4:28", or "12.4" (seconds) in the last minute;
    /// null when it can't be read.
    /// </summary>
    private static TimeSpan? Left(string? clock)
    {
        if (clock is null)
            return null;
        var parts = clock.Split(':');
        var seconds = 0.0;
        foreach (var part in parts)
        {
            if (!double.TryParse(part, NumberStyles.AllowDecimalPoint, CultureInfo.InvariantCulture, out var value))
                return null;
            seconds = seconds * 60 + value;
        }
        return parts.Length <= 2 ? TimeSpan.FromSeconds(seconds) : null;
    }
}
