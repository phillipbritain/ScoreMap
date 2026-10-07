using ScoreMap.Server.GameFeed;

namespace ScoreMap.Server.Scenarios;

/// <summary>
/// The fake game feed provider (ADR-0009): stands in for ESPN's and answers from the running
/// scenario, so everything after the feed is the real code. The scenario starts when the provider
/// is made, at server startup, on the real clock.
/// </summary>
public sealed class ScenarioGameFeedProvider(Scenario scenario, TimeProvider clock) : IGameFeedProvider
{
    private readonly DateTimeOffset _startedAt = clock.GetUtcNow();

    public Task<IReadOnlyList<ProviderGame>> FetchScoreboardAsync(string leagueKey, CancellationToken cancellationToken)
    {
        IReadOnlyList<ProviderGame> games = scenario.Games
            .Where(game => game.LeagueKey == leagueKey)
            .Select(game => game.ToProviderGame(_startedAt))
            .ToList();
        return Task.FromResult(games);
    }
}
