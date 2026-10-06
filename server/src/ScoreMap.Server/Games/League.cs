namespace ScoreMap.Server.Games;

/// <summary>A league ScoreMap shows. Configured under "Leagues" in appsettings.json.</summary>
public sealed class League
{
    /// <summary>The key the game feed provider knows the league by.</summary>
    public required string Key { get; init; }

    public required string Name { get; init; }

    /// <summary>
    /// The league's sport, configured by its display name ("American football", "Basketball", "Baseball",
    /// "Hockey" or "Soccer"). The clock line is written in the sport's style.
    /// </summary>
    public required Sport Sport { get; init; }

    /// <summary>
    /// How many periods make up a game before overtime, when the league differs from its sport's usual
    /// (e.g. 2 for college basketball's halves). Used only to write the clock line.
    /// </summary>
    public int? RegulationPeriods { get; init; }

    /// <summary>
    /// How long the league's games are planned to last, start to finish (ADR-0005). A Disrupted game keeps
    /// the pin window of its original schedule, which closes the Final window after this planned end; a game
    /// already Final the first time the board sees it is estimated to have ended at this planned end.
    /// </summary>
    public TimeSpan PlannedLength { get; init; } = TimeSpan.FromHours(3);
}
