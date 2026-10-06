namespace ScoreMap.Server.GameFeed;

/// <summary>
/// The swappable adapter to an outside source of live game data (ADR-0001).
/// Nothing outside an implementation knows the source's response shape.
/// </summary>
public interface IGameFeedProvider
{
    /// <summary>
    /// Fetches the current scoreboard for one league, by its provider key: every game that may be inside
    /// its pin window, each once. That includes games from the previous day that are still Live, recently
    /// Final or Disrupted, and games soon after the next midnight, so pins don't drop or reset at a day boundary.
    /// </summary>
    Task<IReadOnlyList<ProviderGame>> FetchScoreboardAsync(string leagueKey, CancellationToken cancellationToken);
}
