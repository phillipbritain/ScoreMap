using ScoreMap.Server.GameFeed;

namespace ScoreMap.Server.Scenarios;

/// <summary>
/// A scenario's script: changes to its games at times relative to when the scenario started, in
/// order. After <see cref="Length"/> the scenario starts again with fresh copies of its games.
/// </summary>
public sealed record ScenarioTimeline(TimeSpan Length, IReadOnlyList<ScenarioChange> Changes)
{
    /// <summary>The changes made by <paramref name="elapsed"/> into a loop, in order.</summary>
    public IEnumerable<ScenarioChange> ChangesUntil(TimeSpan elapsed) => Changes.TakeWhile(change => change.At <= elapsed);
}

/// <summary>
/// One scripted change to one game at <see cref="At"/>: whichever of its score, status, period,
/// clock and phase (a break starts or ends) are given; the rest stay as they were.
/// </summary>
public sealed record ScenarioChange(
    TimeSpan At,
    string GameId,
    int? HomeScore = null,
    int? AwayScore = null,
    ProviderStatus? Status = null,
    int? Period = null,
    string? Clock = null,
    ProviderPeriodPhase? Phase = null)
{
    public ScenarioGame ApplyTo(ScenarioGame game) => game with
    {
        Home = HomeScore is { } home ? game.Home with { Score = home } : game.Home,
        Away = AwayScore is { } away ? game.Away with { Score = away } : game.Away,
        Status = Status ?? game.Status,
        Period = Period ?? game.Period,
        Clock = Clock ?? game.Clock,
        Phase = Phase ?? game.Phase,
    };
}
