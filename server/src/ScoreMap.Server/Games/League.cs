namespace ScoreMap.Server.Games;

/// <summary>A league ScoreMap shows. Configured under "Leagues" in appsettings.json.</summary>
public sealed class League
{
    /// <summary>The key the game feed provider knows the league by.</summary>
    public required string Key { get; init; }

    public required string Name { get; init; }

    public required string Sport { get; init; }
}
