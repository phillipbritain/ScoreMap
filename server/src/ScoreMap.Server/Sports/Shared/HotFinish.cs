using ScoreMap.Server.GameFeed;
using ScoreMap.Server.Games;

namespace ScoreMap.Server.Sports.Shared;

internal static class HotFinish
{
    internal static bool Timed(ProviderGame game, ProviderSides sides, int period, int regulation, TimeSpan lastMinutes, int withinPoints)
    {
        if (Margin(sides) is not { } margin || margin > withinPoints)
            return false;
        return period > regulation || (period == regulation && PeriodClock.TimeLeft(game.DisplayClock) <= lastMinutes);
    }

    internal static int? Minute(string? clock) =>
        int.TryParse(new string((clock ?? "").TakeWhile(char.IsAsciiDigit).ToArray()), out var minute) ? minute : null;

    internal static int? Margin(ProviderSides sides) =>
        sides.Home.Score is { } home && sides.Away.Score is { } away ? Math.Abs(home - away) : null;
}
