using ScoreMap.Server.GameFeed;
using ScoreMap.Server.Games;
using ScoreMap.Server.Scenarios;
using ScoreMap.Server.Sports.Shared;

namespace ScoreMap.Server.Sports;

internal sealed partial class SoccerScenario(League league) : SportScenario(league)
{
    internal override SportPlay CreatePlay() => new MinutePlay(League, new(1.4, [(1, 1.0)], 6, null));
}
