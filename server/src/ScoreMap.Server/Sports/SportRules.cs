using ScoreMap.Server.GameFeed;
using ScoreMap.Server.Games;

namespace ScoreMap.Server.Sports;

/// <summary>Explicit supported sports; an unknown value cannot borrow another sport's rules.</summary>
internal static class SportRules
{
    internal static SportRule For(Sport sport) => sport switch
    {
        Sport.Football => FootballRules.Instance,
        Sport.Basketball => BasketballRules.Instance,
        Sport.Baseball => BaseballRules.Instance,
        Sport.Hockey => HockeyRules.Instance,
        Sport.Soccer => SoccerRules.Instance,
        Sport.Cricket => CricketRules.Instance,
        Sport.Rugby => RugbyRules.Instance,
        Sport.Tennis => TennisRules.Instance,
        Sport.Racing => RacingRules.Instance,
        Sport.Golf => GolfRules.Instance,
        Sport.Mma => MmaRules.Instance,
        _ => throw new ArgumentOutOfRangeException(nameof(sport), sport, "No rules for this sport"),
    };
}
