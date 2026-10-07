using ScoreMap.Server.GameFeed;

namespace ScoreMap.Server.Scenarios;

/// <summary>
/// A named set of made-up games at real venues, shown in place of real games when ScoreMap runs
/// locally (ADR-0009). Read from a scenario file by <see cref="ScenarioReader"/>, checked against
/// the configured leagues.
/// </summary>
public sealed record Scenario(string Name, IReadOnlyList<ScenarioGame> Games);

/// <summary>
/// One made-up game in a scenario. <see cref="StartsIn"/> is its start relative to when the scenario
/// started (negative for a game already under way).
/// </summary>
public sealed record ScenarioGame(
    string Id,
    string LeagueKey,
    TimeSpan StartsIn,
    ProviderTeam Home,
    ProviderTeam Away,
    ProviderVenue Venue,
    ProviderStatus Status,
    string? Clock,
    int? Period,
    ProviderPeriodPhase Phase)
{
    /// <summary>The game as the feed reports it, for a scenario that started at <paramref name="scenarioStart"/>.</summary>
    public ProviderGame ToProviderGame(DateTimeOffset scenarioStart) => new(
        Id: Id,
        LeagueKey: LeagueKey,
        StartTime: scenarioStart + StartsIn,
        Home: Home,
        Away: Away,
        Status: Status,
        DisplayClock: Clock,
        Period: Period,
        Venue: Venue,
        Broadcasters: [],
        Phase: Phase);
}
