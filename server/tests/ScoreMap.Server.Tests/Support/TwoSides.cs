using ScoreMap.Server.GameFeed;
using ScoreMap.Server.Games;

namespace ScoreMap.Server.Tests.Support;

/// <summary>The two sides of a game the test knows is between two sides.</summary>
public static class TwoSides
{
    public static ProviderSides Sides(this ProviderGame game) => (ProviderSides)game.Contest;

    public static GameSides Sides(this Game game) => (GameSides)game.Contest;

    /// <summary>The game with its home side, its away side or both changed.</summary>
    public static ProviderGame WithSides(this ProviderGame game, ProviderTeam? home = null, ProviderTeam? away = null) =>
        game with { Contest = new ProviderSides(home ?? game.Sides().Home, away ?? game.Sides().Away) };
}
