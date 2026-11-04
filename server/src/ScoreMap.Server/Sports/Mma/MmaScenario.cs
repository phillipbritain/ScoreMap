using ScoreMap.Server.GameFeed;
using ScoreMap.Server.Games;
using ScoreMap.Server.Scenarios;
using ScoreMap.Server.Sports.Shared;

namespace ScoreMap.Server.Sports;

internal sealed partial class MmaScenario(League league) : SportScenario(league)
{
    // Preserve the existing two-sided fill behaviour; this does not add specialized fill support.
    internal override SportPlay CreatePlay() => new CountdownPlay(League, new(1.4, [(1, 1.0)], 6, null));
}
