using Microsoft.Extensions.Time.Testing;
using ScoreMap.Server.GameFeed;

namespace ScoreMap.Server.Tests.Support;

/// <summary>A game feed provider whose scoreboards the test sets directly, and which counts every fetch.</summary>
public sealed class FakeGameFeedProvider : IGameFeedProvider
{
    private readonly Dictionary<string, IReadOnlyList<ProviderGame>> _scoreboards = new();
    private readonly Dictionary<string, int> _fetches = new();
    private readonly HashSet<string> _failing = [];
    private readonly HashSet<string> _timingOut = [];
    private readonly HashSet<string> _holding = [];
    private readonly Dictionary<string, (FakeTimeProvider Clock, TimeSpan Takes)> _slow = new();
    private readonly TaskCompletionSource _heldFetchCancelled = new(TaskCreationOptions.RunContinuationsAsynchronously);

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

    /// <summary>
    /// Makes every fetch of the league time out, failing the way HttpClient does when its
    /// timeout passes: a TaskCanceledException (an OperationCanceledException) around a TimeoutException.
    /// </summary>
    public void TimeOut(string leagueKey)
    {
        lock (_scoreboards)
            _timingOut.Add(leagueKey);
    }

    /// <summary>
    /// Makes fetches of the league hang until whoever asked cancels them, as a slow source would
    /// leave a snapshot waiting. See <see cref="HeldFetchCancelledAsync"/>.
    /// </summary>
    public void Hold(string leagueKey)
    {
        lock (_scoreboards)
            _holding.Add(leagueKey);
    }

    /// <summary>
    /// Makes every fetch of the league take <paramref name="takes"/> on <paramref name="clock"/>, as a
    /// slow source would (or as a test moving the clock while a fetch is under way does).
    /// </summary>
    public void TakeTime(string leagueKey, FakeTimeProvider clock, TimeSpan takes)
    {
        lock (_scoreboards)
            _slow[leagueKey] = (clock, takes);
    }

    /// <summary>Waits (in real time, briefly) until a held fetch has been cancelled.</summary>
    public Task HeldFetchCancelledAsync() => _heldFetchCancelled.Task.WaitAsync(TimeSpan.FromSeconds(10));

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
        (FakeTimeProvider Clock, TimeSpan Takes) slow;
        lock (_scoreboards)
            _slow.TryGetValue(leagueKey, out slow);
        slow.Clock?.Advance(slow.Takes);
        lock (_scoreboards)
        {
            _fetches[leagueKey] = _fetches.GetValueOrDefault(leagueKey) + 1;
            if (_failing.Contains(leagueKey))
                return Task.FromException<IReadOnlyList<ProviderGame>>(new HttpRequestException("feed is down"));
            if (_holding.Contains(leagueKey))
                return HangUntilCancelledAsync(cancellationToken);
            if (_timingOut.Contains(leagueKey))
                return Task.FromException<IReadOnlyList<ProviderGame>>(new TaskCanceledException(
                    "The request was canceled due to the configured HttpClient.Timeout of 10 seconds elapsing.",
                    new TimeoutException("The operation was canceled.")));
            return Task.FromResult(_scoreboards.TryGetValue(leagueKey, out var games) ? games : []);
        }
    }

    private async Task<IReadOnlyList<ProviderGame>> HangUntilCancelledAsync(CancellationToken cancellationToken)
    {
        try
        {
            await Task.Delay(Timeout.Infinite, cancellationToken);
            return [];
        }
        finally
        {
            _heldFetchCancelled.TrySetResult();
        }
    }
}
