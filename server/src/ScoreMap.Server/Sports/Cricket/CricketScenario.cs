using ScoreMap.Server.GameFeed;
using ScoreMap.Server.Games;
using ScoreMap.Server.Scenarios;
using ScoreMap.Server.Sports.Shared;

namespace ScoreMap.Server.Sports;

internal sealed partial class CricketScenario(League league) : SportScenario(league)
{
    internal override SportPlay CreatePlay() => new CricketPlay(League);
}
