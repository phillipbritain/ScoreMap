using ScoreMap.Server.GameFeed;
using ScoreMap.Server.Games;
using ScoreMap.Server.Scenarios;
using ScoreMap.Server.Sports.Shared;

namespace ScoreMap.Server.Sports;

internal sealed partial class BaseballScenario(League league) : SportScenario(league)
{
    internal override SportPlay CreatePlay() => new BaseballPlay(League, new(3, [(1, 0.65), (2, 0.25), (3, 0.08), (4, 0.02)], 11, 1));
}
