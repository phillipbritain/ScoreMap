namespace ScoreMap.Server.Games;

/// <summary>A league ScoreMap shows. Configured under "Leagues" in appsettings.json.</summary>
public sealed class League
{
    /// <summary>The key the game feed provider knows the league by.</summary>
    public required string Key { get; init; }

    public required string Name { get; init; }

    /// <summary>
    /// The sport's display name. The clock line is written in the sport's style for "American football",
    /// "Basketball", "Baseball", "Hockey" and "Soccer"; any other sport shows the provider's clock as is.
    /// </summary>
    public required string Sport { get; init; }

    /// <summary>
    /// How many periods make up a game before overtime, when the league differs from its sport's usual
    /// (e.g. 2 for college basketball's halves). Used only to write the clock line.
    /// </summary>
    public int? RegulationPeriods { get; init; }

    /// <summary>
    /// How long the league's games are planned to last, start to finish. A Disrupted game keeps the pin
    /// window of its original schedule, which closes the Final window after this planned end.
    /// </summary>
    public TimeSpan PlannedLength { get; init; } = TimeSpan.FromHours(3);
}
