using ScoreMap.Server.GameFeed;
using ScoreMap.Server.Games;
using ScoreMap.Server.Scenarios;
using ScoreMap.Server.Sports.Shared;

namespace ScoreMap.Server.Sports;

internal sealed partial class HockeyScenario(League league) : SportScenario(league)
{
    internal override SportPlay CreatePlay() => new CountdownPlay(League, new(3, [(1, 1.0)], 7, 1));
}
