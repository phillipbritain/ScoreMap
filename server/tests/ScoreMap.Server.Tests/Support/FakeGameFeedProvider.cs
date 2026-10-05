using ScoreMap.Server.GameFeed;

namespace ScoreMap.Server.Tests.Support;

/// <summary>A game feed provider whose scoreboards the test sets directly, and which counts every fetch.</summary>
public sealed class FakeGameFeedProvider : IGameFeedProvider
{
    private readonly Dictionary<string, IReadOnlyList<ProviderGame>> _scoreboards = new();
    private readonly Dictionary<string, int> _fetches = new();
    private readonly HashSet<string> _failing = [];

    public void SetScoreboard(string leagueKey, params ProviderGame[] games)
    {
        lock (_scoreboards)
            _scoreboards[leagueKey] = games;
    }

    /// <summary>Makes every fetch of the league throw, as if the source were down.</summary>
    public void Fail(string leagueKey)
    {
        lock (_scoreboards)
            _failing.Add(leagueKey);
    }

    /// <summary>How many times the league's scoreboard has been fetched.</summary>
    public int Fetches(string leagueKey)
    {
        lock (_scoreboards)
            return _fetches.GetValueOrDefault(leagueKey);
    }

    /// <summary>Waits (in real time, briefly) until the league has been fetched at least <paramref name="count"/> times.</summary>
    public async Task WaitForFetchesAsync(string leagueKey, int count)
    {
        var deadline = DateTime.UtcNow.AddSeconds(10);
        while (Fetches(leagueKey) < count)
        {
            if (DateTime.UtcNow > deadline)
                throw new TimeoutException($"{leagueKey} fetched {Fetches(leagueKey)} times, expected {count}");
            await Task.Delay(10);
        }
    }

    public Task<IReadOnlyList<ProviderGame>> FetchScoreboardAsync(string leagueKey, CancellationToken cancellationToken)
    {
        lock (_scoreboards)
        {
            _fetches[leagueKey] = _fetches.GetValueOrDefault(leagueKey) + 1;
            if (_failing.Contains(leagueKey))
                return Task.FromException<IReadOnlyList<ProviderGame>>(new HttpRequestException("feed is down"));
            return Task.FromResult(_scoreboards.TryGetValue(leagueKey, out var games) ? games : []);
        }
    }
}
