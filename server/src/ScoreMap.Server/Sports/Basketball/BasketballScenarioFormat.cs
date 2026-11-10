using ScoreMap.Server.Games;
using ScoreMap.Server.Sports.Shared;

namespace ScoreMap.Server.Sports;

/// <summary>The league's scoring for its scenario variant.</summary>
internal static class BasketballScenarioFormat
{
    private static readonly (int, double)[] Points = [(1, 0.15), (2, 0.6), (3, 0.25)];

    internal static PlayScoring For(League league) => league.Regulation == 2
        ? new(34, Points, 100, 2)
        : league.PeriodClockMinutes == 10
            ? new(36, Points, 115, 2)
            : new(52, Points, 137, 2);
}
