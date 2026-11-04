using ScoreMap.Server.GameFeed;
using ScoreMap.Server.Games;
using ScoreMap.Server.Scenarios;
using ScoreMap.Server.Sports.Shared;

namespace ScoreMap.Server.Sports;

internal sealed partial class BasketballScenario(League league) : SportScenario(league)
{
    private static readonly (int, double)[] Points = [(1, 0.15), (2, 0.6), (3, 0.25)];

    internal override SportPlay CreatePlay() => new CountdownPlay(League, League.Regulation == 2
        ? new(34, Points, 100, 2)
        : League.PeriodClockMinutes == 10 ? new(36, Points, 115, 2) : new(52, Points, 137, 2));
}
