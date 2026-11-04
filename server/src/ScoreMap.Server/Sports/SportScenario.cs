using ScoreMap.Server.GameFeed;
using ScoreMap.Server.Games;
using ScoreMap.Server.Scenarios;
using ScoreMap.Server.Sports.Shared;

namespace ScoreMap.Server.Sports;

internal abstract partial class SportScenario(League league)
{
    protected League League { get; } = league;
    internal abstract SportPlay CreatePlay();
}
