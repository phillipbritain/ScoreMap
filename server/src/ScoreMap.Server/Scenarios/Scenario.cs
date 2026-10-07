using ScoreMap.Server.GameFeed;

namespace ScoreMap.Server.Scenarios;

/// <summary>
/// A named set of made-up games at real venues, shown in place of real games when ScoreMap runs
/// locally (ADR-0009). Read from a scenario file by <see cref="ScenarioReader"/>, checked against
/// the configured leagues. With a <see cref="Timeline"/>, its games change as the script says; with
/// <see cref="Play"/>, they play out at random (see <see cref="RandomPlayGames"/>).
/// </summary>
public sealed record Scenario(string Name, IReadOnlyList<ScenarioGame> Games, ScenarioTimeline? Timeline = null, RandomPlay? Play = null)
{
    /// <summary>
    /// The games as the feed reports them at <paramref name="now"/>, for a scenario that started at
    /// <paramref name="startedAt"/>. Each time the timeline ends the scenario starts again: its games
    /// come back as they were written, as fresh copies under new ids, so a Final game never goes
    /// back to Live (ADR-0009).
    /// </summary>
    public IReadOnlyList<ProviderGame> GamesAt(DateTimeOffset startedAt, DateTimeOffset now)
    {
        if (Timeline is null)
            return Games.Select(game => game.ToProviderGame(startedAt)).ToList();

        var loop = Math.Max(0, (now - startedAt).Ticks / Timeline.Length.Ticks);
        var loopStartedAt = startedAt + Timeline.Length * loop;
        var changes = Timeline.ChangesUntil(now - loopStartedAt).ToList();
        return Games
            .Select(game => changes.Where(change => change.GameId == game.Id).Aggregate(game, (g, change) => change.ApplyTo(g)))
            .Select(game => game.ToProviderGame(loopStartedAt) with { Id = CopyId(game.Id, loop) })
            .ToList();
    }

    /// <summary>The id of a game's copy in a loop: as written the first time round, then <c>&lt;id&gt;-loop2</c>, and so on.</summary>
    private static string CopyId(string id, long loop) => loop == 0 ? id : $"{id}-loop{loop + 1}";
}

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
