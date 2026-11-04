using ScoreMap.Server.GameFeed;
using ScoreMap.Server.Games;
using ScoreMap.Server.Scenarios;
using ScoreMap.Server.Sports.Shared;
using static ScoreMap.Server.Sports.Shared.ScenarioFabrication;

namespace ScoreMap.Server.Sports;

/// <summary>The league's one scenario variant, shared by its scoring and odds.</summary>
internal sealed record BasketballScenarioFormat(PlayScoring Scoring, int SpreadMax, double TotalMin, double TotalMax)
{
    private static readonly (int, double)[] Points = [(1, 0.15), (2, 0.6), (3, 0.25)];

    internal static BasketballScenarioFormat For(League league) => league.Regulation == 2
        ? new(new(34, Points, 100, 2), 15, 128.5, 158.5)
        : league.PeriodClockMinutes == 10
            ? new(new(36, Points, 115, 2), 12, 150.5, 172.5)
            : new(new(52, Points, 137, 2), 13, 208.5, 241.5);
}
