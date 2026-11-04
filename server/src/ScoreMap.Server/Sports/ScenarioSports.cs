using ScoreMap.Server.GameFeed;
using ScoreMap.Server.Games;
using ScoreMap.Server.Scenarios;
using ScoreMap.Server.Sports.Shared;

namespace ScoreMap.Server.Sports;

internal static class ScenarioSports
{
    internal static SportScenario For(League league) => league.Sport switch
    {
        Sport.Football => new FootballScenario(league),
        Sport.Basketball => new BasketballScenario(league),
        Sport.Baseball => new BaseballScenario(league),
        Sport.Hockey => new HockeyScenario(league),
        Sport.Soccer => new SoccerScenario(league),
        Sport.Cricket => new CricketScenario(league),
        Sport.Rugby => new RugbyScenario(league),
        Sport.Tennis => new TennisScenario(league),
        Sport.Racing => new RacingScenario(league),
        Sport.Golf => new GolfScenario(league),
        Sport.Mma => new MmaScenario(league),
        _ => throw new ArgumentOutOfRangeException(nameof(league), league.Sport, "No scenario rules for this sport"),
    };
}
