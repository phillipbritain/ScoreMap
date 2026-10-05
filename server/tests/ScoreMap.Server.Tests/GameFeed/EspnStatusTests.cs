using Microsoft.Extensions.Time.Testing;
using ScoreMap.Server.GameFeed;
using ScoreMap.Server.Tests.Support;

namespace ScoreMap.Server.Tests.GameFeed;

/// <summary>ESPN status names that aren't in the saved fixtures, run through the adapter.</summary>
public class EspnStatusTests
{
    private static async Task<ProviderStatus> StatusOfAsync(string name, string state)
    {
        var body = $$$"""
            {"events":[{"id":"1","date":"2026-10-04T17:00Z","status":{"type":{"name":"{{{name}}}","state":"{{{state}}}"}},
              "competitions":[{"competitors":[
                {"homeAway":"home","team":{"abbreviation":"KC"},"score":"7"},
                {"homeAway":"away","team":{"abbreviation":"BUF"},"score":"3"}]}]}]}
            """;
        var provider = new EspnGameFeedProvider(
            new HttpClient(StubHttpHandler.Returning(body)) { BaseAddress = new Uri("https://espn.test/sports/") },
            new FakeTimeProvider(new DateTimeOffset(2026, 10, 4, 18, 0, 0, TimeSpan.Zero)));
        var game = Assert.Single(await provider.FetchScoreboardAsync("football/nfl", CancellationToken.None));
        return game.Status;
    }

    [Theory]
    [InlineData("STATUS_HALFTIME", "in", ProviderStatus.InProgress)]
    [InlineData("STATUS_END_PERIOD", "in", ProviderStatus.InProgress)]
    [InlineData("STATUS_RAIN_DELAY", "in", ProviderStatus.Delayed)]
    [InlineData("STATUS_DELAYED", "in", ProviderStatus.Delayed)]
    [InlineData("STATUS_FINAL_OT", "post", ProviderStatus.Final)]
    [InlineData("STATUS_SOMETHING_NEW", "in", ProviderStatus.InProgress)]
    public async Task Status_names_map_to_provider_statuses(string name, string state, ProviderStatus expected)
    {
        Assert.Equal(expected, await StatusOfAsync(name, state));
    }
}
