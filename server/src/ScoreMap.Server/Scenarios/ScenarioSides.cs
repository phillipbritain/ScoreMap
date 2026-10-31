using ScoreMap.Server.GameFeed;

namespace ScoreMap.Server.Scenarios;

/// <summary>Scenarios make only games between two sides.</summary>
internal static class ScenarioSides
{
    /// <summary>A scenario game's two sides.</summary>
    public static ProviderSides Sides(this ProviderGame game) => (ProviderSides)game.Contest;
}
