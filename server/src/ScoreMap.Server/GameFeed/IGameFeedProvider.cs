namespace ScoreMap.Server.GameFeed;

/// <summary>
/// The swappable adapter to an outside source of live game data (ADR-0001).
/// Nothing outside an implementation knows the source's response shape.
/// </summary>
public interface IGameFeedProvider
{
    /// <summary>
    /// Fetches the current scoreboard for one league, by its provider key: every game that may be inside
    /// its pin window, each once. That includes games from the previous day that are still Live or recently
    /// Final, and games soon after the next midnight, so pins don't drop or reset at a day boundary.
    /// </summary>
    Task<IReadOnlyList<ProviderGame>> FetchScoreboardAsync(string leagueKey, CancellationToken cancellationToken);

    /// <summary>
    /// Returns optional details already available and starts any missing lookup without waiting.
    /// Call only for games inside their pin windows; new details arrive on a later poll.
    /// Cancellation stops queued and active optional work.
    /// </summary>
    ProviderGame EnrichGame(ProviderGame game, CancellationToken cancellationToken) => game;

    /// <summary>
    /// Fetches the games the source picks as its most important right now, across every sport (ESPN's
    /// Top Events), by game id. It may list games in leagues ScoreMap doesn't show.
    /// </summary>
    Task<IReadOnlySet<string>> FetchTopEventsAsync(CancellationToken cancellationToken);
}
