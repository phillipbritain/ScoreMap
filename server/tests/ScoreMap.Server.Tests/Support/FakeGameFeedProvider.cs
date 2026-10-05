using ScoreMap.Server.GameFeed;

namespace ScoreMap.Server.Tests.Support;

/// <summary>A game feed provider whose scoreboards the test sets directly.</summary>
public sealed class FakeGameFeedProvider : IGameFeedProvider
{
    private readonly Dictionary<string, IReadOnlyList<ProviderGame>> _scoreboards = new();

    public void SetScoreboard(string leagueKey, params ProviderGame[] games) =>
        _scoreboards[leagueKey] = games;

    public Task<IReadOnlyList<ProviderGame>> FetchScoreboardAsync(string leagueKey, CancellationToken cancellationToken) =>
        Task.FromResult(_scoreboards.TryGetValue(leagueKey, out var games) ? games : []);
}
