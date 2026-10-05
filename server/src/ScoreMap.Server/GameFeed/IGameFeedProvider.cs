namespace ScoreMap.Server.GameFeed;

/// <summary>
/// The swappable adapter to an outside source of live game data (ADR-0001).
/// Nothing outside an implementation knows the source's response shape.
/// </summary>
public interface IGameFeedProvider
{
    /// <summary>Fetches the current scoreboard for one league, by its provider key.</summary>
    Task<IReadOnlyList<ProviderGame>> FetchScoreboardAsync(string leagueKey, CancellationToken cancellationToken);
}
