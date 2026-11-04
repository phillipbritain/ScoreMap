using ScoreMap.Server.GameFeed;

namespace ScoreMap.Server.Sports.Shared;

/// <summary>Access to two sides after scenario play or detail has selected that contest shape.</summary>
internal static class ScenarioSides
{
    /// <summary>A scenario game's two sides.</summary>
    public static ProviderSides Sides(this ProviderGame game) => (ProviderSides)game.Contest;
}
