using System.Globalization;

namespace ScoreMap.Server.Games;

/// <summary>A game clock counting down through a period, as the provider writes it.</summary>
public static class PeriodClock
{
    /// <summary>
    /// The time left in the period: "8:05", or "12.4" (seconds) in a period's last minute, as ESPN writes
    /// basketball's; null when the clock can't be read that way.
    /// </summary>
    public static TimeSpan? TimeLeft(string? clock)
    {
        var parts = (clock ?? "").Split(':');
        if (parts.Length > 2)
            return null;
        var seconds = 0.0;
        foreach (var part in parts)
        {
            if (!double.TryParse(part, NumberStyles.AllowDecimalPoint, CultureInfo.InvariantCulture, out var value))
                return null;
            seconds = seconds * 60 + value;
        }
        return TimeSpan.FromSeconds(seconds);
    }
}
