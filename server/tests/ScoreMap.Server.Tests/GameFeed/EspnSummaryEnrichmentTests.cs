using System.Collections.Concurrent;
using System.Net;
using System.Net.Http.Json;
using System.Threading.Channels;
using Microsoft.Extensions.Time.Testing;
using ScoreMap.Server.GameFeed;
using ScoreMap.Server.Tests.Support;

namespace ScoreMap.Server.Tests.GameFeed;

public class EspnSummaryEnrichmentTests
{
    private static EspnGameFeedProvider Provider(HttpMessageHandler handler) => new(
        new HttpClient(handler) { BaseAddress = new Uri("https://espn.test/sports/") },
        new FakeTimeProvider(new DateTimeOffset(2026, 10, 4, 18, 0, 0, TimeSpan.Zero)));

    private static string Event(string id, string date = "2026-10-04T17:00Z", string state = "in", string status = "STATUS_IN_PROGRESS") => $$$$"""
        {"id":"{{{{id}}}}","date":"{{{{date}}}}","competitions":[{"venue":{"fullName":"Little Caesars Arena"},
        "competitors":[
        {"homeAway":"home","team":{"abbreviation":"DET","displayName":"Detroit Pistons"},"score":"99"},
        {"homeAway":"away","team":{"abbreviation":"ATL","displayName":"Atlanta Hawks"},"score":"98"}],
        "status":{"period":4,"type":{"name":"{{{{status}}}}","state":"{{{{state}}}}"}}}]}
        """;

    private const string Summary = """
        {"scoringPlays":[{"team":{"abbreviation":"ATL"},"text":"A basket","homeScore":99,"awayScore":98,"period":{"number":4}}]}
        """;

    private sealed class HeldSummaries(string scoreboard) : HttpMessageHandler
    {
        public ConcurrentQueue<string> Requested { get; } = new();
        public Channel<string> Started { get; } = Channel.CreateUnbounded<string>();
        public TaskCompletionSource Release { get; } = new(TaskCreationOptions.RunContinuationsAsynchronously);

        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            var uri = request.RequestUri!;
            if (uri.AbsolutePath.EndsWith("/summary", StringComparison.Ordinal))
            {
                Requested.Enqueue(uri.Query);
                Started.Writer.TryWrite(uri.Query);
                await Release.Task.WaitAsync(cancellationToken);
                return Json(Summary);
            }
            return Json(uri.AbsolutePath.Contains("basketball/nba/scoreboard", StringComparison.Ordinal)
                ? scoreboard : "{\"events\":[]}");
        }

        private static HttpResponseMessage Json(string body) => new(HttpStatusCode.OK) { Content = new StringContent(body) };
    }

    [Fact]
    public async Task Summaries_are_bounded_across_leagues_and_cancellation_releases_active_and_queued_work_without_spending_retries()
    {
        using var handler = new HeldSummaries("{\"events\":[" + Event("game") + "]}");
        var provider = Provider(handler);
        var game = Assert.Single(await provider.FetchScoreboardAsync("basketball/nba", CancellationToken.None));
        for (var attempt = 0; attempt < 3; attempt++)
        {
            using var cancel = new CancellationTokenSource();
            for (var i = 0; i < 12; i++)
                provider.EnrichGame(game with { Id = i.ToString(), LeagueKey = i % 2 == 0 ? "basketball/nba" : "hockey/nhl" }, cancel.Token);
            for (var i = 0; i < EspnGameFeedProvider.SummaryConcurrency; i++)
                await handler.Started.Reader.ReadAsync(TestContext.Current.CancellationToken).AsTask().WaitAsync(TimeSpan.FromSeconds(10), TestContext.Current.CancellationToken);
            Assert.Equal((attempt + 1) * 4, handler.Requested.Count);

            // Repeated polls must not queue duplicates of an already queued or active game.
            for (var i = 0; i < 12; i++)
                provider.EnrichGame(game with { Id = i.ToString(), LeagueKey = i % 2 == 0 ? "basketball/nba" : "hockey/nhl" }, cancel.Token);
            await cancel.CancelAsync();
            await provider.EnrichmentFinishedAsync().WaitAsync(TimeSpan.FromSeconds(10), TestContext.Current.CancellationToken);
            Assert.Equal((attempt + 1) * 4, handler.Requested.Count);
        }

        handler.Release.SetResult();
        for (var i = 0; i < 12; i++)
            provider.EnrichGame(game with { Id = i.ToString(), LeagueKey = i % 2 == 0 ? "basketball/nba" : "hockey/nhl" }, CancellationToken.None);
        await provider.EnrichmentFinishedAsync().WaitAsync(TimeSpan.FromSeconds(10), TestContext.Current.CancellationToken);
        Assert.Equal(24, handler.Requested.Count);
        var cached = provider.EnrichGame(game with { Id = "0" }, CancellationToken.None);
        Assert.Equal("A basket", cached.LastScore?.Text);
        await provider.EnrichmentFinishedAsync();
        Assert.Equal(24, handler.Requested.Count);
    }

    [Fact]
    public async Task The_server_delivers_basic_scores_while_a_summary_stalls_and_acquires_details_on_a_later_poll()
    {
        using var handler = new HeldSummaries("{\"events\":[" + Event("game") + "]}");
        var provider = Provider(handler);
        await using var server = new ScoreMapServer { FeedProvider = provider };
        await using var client = await server.ConnectClientAsync();
        var basic = Assert.Single(await client.NextSnapshotAsync());
        Assert.Equal("99", basic.Sides().Home.Score);
        Assert.Null(basic.LastScore);
        await handler.Started.Reader.ReadAsync(TestContext.Current.CancellationToken).AsTask().WaitAsync(TimeSpan.FromSeconds(10), TestContext.Current.CancellationToken);

        handler.Release.SetResult();
        await provider.EnrichmentFinishedAsync().WaitAsync(TimeSpan.FromSeconds(10), TestContext.Current.CancellationToken);
        await server.DisconnectAsync(client);
        server.Clock.Advance(TimeSpan.FromSeconds(16));
        var detailed = Assert.Single(await server.SnapshotOnceAsync());
        Assert.Equal("A basket", detailed.LastScore?.Text);
        Assert.Single(handler.Requested);
    }

    [Fact]
    public async Task Games_outside_pin_windows_never_request_summaries()
    {
        var events = new[]
        {
            Event("old-final", "2026-10-03T17:00Z", "post", "STATUS_FINAL"),
            Event("distant-upcoming", "2026-10-05T17:00Z", "pre", "STATUS_SCHEDULED"),
            Event("old-disrupted", "2026-10-03T17:00Z", "post", "STATUS_CANCELED"),
            Event("live"),
        };
        using var handler = new HeldSummaries("{\"events\":[" + string.Join(',', events) + "]}");
        var provider = Provider(handler);
        await using var server = new ScoreMapServer { FeedProvider = provider };
        await using var client = await server.ConnectClientAsync();
        Assert.Equal("live", Assert.Single(await client.NextSnapshotAsync()).Id);
        handler.Release.SetResult();
        await provider.EnrichmentFinishedAsync().WaitAsync(TimeSpan.FromSeconds(10), TestContext.Current.CancellationToken);
        Assert.Equal(["?event=live"], handler.Requested.ToArray());
    }

    [Fact]
    public async Task A_summary_finishing_after_a_source_switch_does_not_enrich_the_scenario()
    {
        using var handler = new HeldSummaries("{\"events\":[" + Event("game") + "]}");
        var provider = Provider(handler);
        await using var server = new ScoreMapServer { FeedProvider = provider, Scenario = "real" };
        server.WriteScenario("other", """
            {"games":[{"id":"game","league":"NBA","home":{"name":"Detroit Pistons","abbreviation":"DET","score":10},
            "away":{"name":"Atlanta Hawks","abbreviation":"ATL","score":8},"venue":{"name":"Imaginary Arena","city":"Detroit","notInVenueList":true},
            "startsIn":"-40m","status":"live"}]}
            """);
        await using var client = await server.ConnectClientAsync();
        await client.NextSnapshotAsync();
        await handler.Started.Reader.ReadAsync(TestContext.Current.CancellationToken).AsTask().WaitAsync(TimeSpan.FromSeconds(10), TestContext.Current.CancellationToken);
        using var http = server.CreateClient();
        (await http.PutAsJsonAsync("/api/scenarios/running", new { name = "other" }, TestContext.Current.CancellationToken)).EnsureSuccessStatusCode();
        var scenario = Assert.Single(await server.SnapshotOnceAsync());
        // Switching retires the poller's generation: optional work must finish by cancellation,
        // even while fake HTTP is still stalled, before it can publish anything to the cache.
        await provider.EnrichmentFinishedAsync().WaitAsync(TimeSpan.FromSeconds(10), TestContext.Current.CancellationToken);
        handler.Release.SetResult();
        server.Clock.Advance(TimeSpan.FromSeconds(2));
        var after = Assert.Single(await server.SnapshotOnceAsync());
        Assert.Equal("10", after.Sides().Home.Score);
        Assert.Equal(scenario.LastScore, after.LastScore);
        Assert.DoesNotContain("A basket", after.LastScore?.Text ?? "");
    }
}
