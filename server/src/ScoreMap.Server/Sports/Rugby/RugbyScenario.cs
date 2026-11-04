using ScoreMap.Server.GameFeed;
using ScoreMap.Server.Games;
using ScoreMap.Server.Scenarios;
using ScoreMap.Server.Sports.Shared;

namespace ScoreMap.Server.Sports;

internal sealed partial class RugbyScenario(League league) : SportScenario(league)
{
    private static readonly (int Points, double Chance)[] Scores = [(7, 0.4), (5, 0.2), (3, 0.4)];
    internal override SportPlay CreatePlay() => new MinutePlay(League, new(5.5, Scores, 60, null));
}
