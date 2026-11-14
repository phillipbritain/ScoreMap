namespace ScoreMap.Server.Games;

/// <summary>A league ScoreMap shows. Configured under "Leagues" in appsettings.json.</summary>
public sealed class League
{
    /// <summary>The key the game feed provider knows the league by.</summary>
    public required string Key { get; init; }

    public required string Name { get; init; }

    /// <summary>
    /// The league's sport, configured by its display name ("Football", "Basketball", "Baseball",
    /// "Hockey", "Soccer", "Cricket", "Rugby", "Tennis", "Racing", "Golf" or "MMA"). The clock line is written in the sport's style.
    /// </summary>
    public required Sport Sport { get; init; }

    /// <summary>
    /// How many periods make up a game before overtime, when the league differs from its sport's usual
    /// (e.g. 2 for men's college basketball's halves). Read <see cref="Regulation"/> instead.
    /// </summary>
    public int? RegulationPeriods { get; init; }

    /// <summary>
    /// How many minutes a period lasts on the game clock, when the league differs from its sport's usual
    /// (e.g. 10 for women's basketball's quarters). Read <see cref="PeriodClockMinutes"/> instead.
    /// </summary>
    public int? PeriodMinutes { get; init; }

    /// <summary>How many periods make up a game before overtime, in this league.</summary>
    public int Regulation => RegulationPeriods ?? Sport.Usual().RegulationPeriods;

    /// <summary>How many minutes a period lasts on the game clock, in this league; null in a sport without one.</summary>
    public int? PeriodClockMinutes => PeriodMinutes ?? Sport.Usual().PeriodMinutes;

    /// <summary>
    /// How long the league's games are planned to last, start to finish (ADR-0005). A game already Final
    /// the first time the board sees it is estimated to have ended at this planned end.
    /// </summary>
    public TimeSpan PlannedLength { get; init; } = TimeSpan.FromHours(3);

    /// <summary>
    /// The league's conferences the viewer can filter its games by (college leagues), each by its ESPN group
    /// id, which differs from sport to sport; none for a league without them.
    /// </summary>
    public IReadOnlyList<Conference> Conferences { get; init; } = [];

    /// <summary>The name of the conference with this ESPN group id; null when the id is null or not one of <see cref="Conferences"/>.</summary>
    public string? ConferenceName(string? id) =>
        id is null ? null : Conferences.FirstOrDefault(conference => conference.Id == id)?.Name;
}

/// <summary>A conference in a college league: its ESPN group id and the short name the viewer picks it by ("SEC").</summary>
public sealed class Conference
{
    public required string Id { get; init; }

    public required string Name { get; init; }
}
