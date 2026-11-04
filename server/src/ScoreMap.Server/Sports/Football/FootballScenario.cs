using ScoreMap.Server.GameFeed;
using ScoreMap.Server.Games;
using ScoreMap.Server.Scenarios;
using ScoreMap.Server.Sports.Shared;

namespace ScoreMap.Server.Sports;

internal sealed partial class FootballScenario(League league) : SportScenario(league)
{
    internal override SportPlay CreatePlay() => new CountdownPlay(League, new(3.5, [(7, 0.7), (3, 0.3)], 47, 3));
}
