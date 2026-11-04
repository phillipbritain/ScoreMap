using ScoreMap.Server.Sports;
using ScoreMap.Server.Sports.Shared;
using ScoreMap.Server.GameFeed;

namespace ScoreMap.Server.Games;

/// <summary>
/// The short line saying where a game stands, written the way its sport reads it:
/// "Q3 4:12", "Halftime", "Final/OT", "13.2/20 ov · need 87", "Lap 189", "R2" and so on.
/// </summary>
public static class ClockLine
{
    public static string? For(ProviderGame game, League league) => SportRules.For(league.Sport).Clock(game, league);
    public static string? When(ProviderScoringPlay play, League league) => SportRules.For(league.Sport).When(play, league);
    internal static string? MethodName(BoutMethod? method) => MmaRules.MethodName(method);
    internal static string Ordinal(int n) => ClockFormat.Ordinal(n);
}
