using ScoreMap.Server.GameFeed;
using ScoreMap.Server.Games;
using ScoreMap.Server.Scenarios;
using static ScoreMap.Server.Sports.Shared.ScenarioFabrication;

namespace ScoreMap.Server.Sports.Shared;

/// <summary>Existing generic content, explicitly selected where specialized scenarios do not exist yet.</summary>
internal static class LegacyScenarioDetails
{
    internal static string QualifierNote(Random random) => Pick(random, "Qualifier 1", "Eliminator", "Final");
    internal static (string, double) GoalOdds(Random random, ProviderTeam favorite) =>
        ($"{favorite.Abbreviation} -{random.Next(105, 260)}", 2.5 + random.Next(2));
    internal static string HockeyScore(int points, Random random) => $"{Player(random)} Goal ({random.Next(1, 30)}) {Pick(random, "Wrist Shot", "Snap Shot", "Slap Shot", "Backhand", "Tip-In")}, assists: {Player(random)}";
}
