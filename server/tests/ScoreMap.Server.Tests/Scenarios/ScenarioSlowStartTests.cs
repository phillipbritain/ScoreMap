using System.Net.Http.Json;
using Microsoft.Extensions.Time.Testing;
using ScoreMap.Server.Tests.Support;
using ScenarioListing = ScoreMap.Server.Scenarios.ScenarioEndpoints.ScenarioListing;

namespace ScoreMap.Server.Tests.Scenarios;

public class ScenarioSlowStartTests
{
    private static string OneGame(string slowStart) => $$"""
        {
          {{slowStart}}
          "games": [
            {
              "id": "a",
              "league": "NFL",
              "home": { "name": "Kansas City Chiefs", "abbreviation": "KC", "score": 14 },
              "away": { "name": "Buffalo Bills", "abbreviation": "BUF", "score": 10 },
              "venue": { "name": "Arrowhead Stadium", "city": "Kansas City", "region": "MO", "country": "USA" },
              "startsIn": "-40m",
              "status": "live"
            }
          ]
        }
        """;

    [Fact]
    public async Task A_scenario_with_a_slow_start_holds_back_each_browsers_first_games_that_long_in_real_time()
    {
        var slowStart = TimeSpan.FromSeconds(12);
        var clock = new SlowStartClock(slowStart);
        await using var server = new ScoreMapServer { Scenario = "slow", Clock = clock };
        server.WriteScenario("slow", OneGame("\"slowStart\": \"12s\","));
        await using var client = await server.ConnectClientAsync();
        var snapshot = client.NextSnapshotAsync();

        // Start measuring only once the hub's delay is registered. Client delivery may take
        // arbitrary real time, so it must never cause us to advance the fake clock further.
        await clock.DelayScheduled.WaitAsync(TimeSpan.FromSeconds(10), TestContext.Current.CancellationToken);
        clock.Advance(slowStart - TimeSpan.FromTicks(1));
        Assert.False(snapshot.IsCompleted);

        clock.Advance(TimeSpan.FromTicks(1));
        Assert.Equal("a", Assert.Single(await snapshot).Id);
    }

    private sealed class SlowStartClock(TimeSpan slowStart)
        : FakeTimeProvider(new DateTimeOffset(2026, 10, 4, 18, 0, 0, TimeSpan.Zero))
    {
        private readonly TaskCompletionSource _scheduled = new(TaskCreationOptions.RunContinuationsAsynchronously);

        public Task DelayScheduled => _scheduled.Task;

        public override ITimer CreateTimer(TimerCallback callback, object? state, TimeSpan dueTime, TimeSpan period)
        {
            var timer = base.CreateTimer(callback, state, dueTime, period);
            if (dueTime == slowStart && period == Timeout.InfiniteTimeSpan)
                _scheduled.TrySetResult();
            return timer;
        }
    }

    [Fact]
    public async Task The_listing_says_whether_the_running_scenario_starts_slowly_so_the_browser_that_picks_it_can_reload()
    {
        await using var server = new ScoreMapServer { Scenario = "quick" };
        server.WriteScenario("quick", OneGame(""));
        server.WriteScenario("slow", OneGame("\"slowStart\": \"12s\","));
        using var http = server.CreateClient();

        Assert.False((await http.GetFromJsonAsync<ScenarioListing>("/api/scenarios", TestContext.Current.CancellationToken))?.StartsSlowly);
        var response = await http.PutAsJsonAsync("/api/scenarios/running", new { name = "slow" }, TestContext.Current.CancellationToken);

        Assert.True((await response.Content.ReadFromJsonAsync<ScenarioListing>(TestContext.Current.CancellationToken))?.StartsSlowly);
    }

    [Fact]
    public async Task Without_a_slow_start_the_first_games_come_straight_away()
    {
        await using var server = new ScoreMapServer { Scenario = "quick" };
        server.WriteScenario("quick", OneGame(""));
        await using var client = await server.ConnectClientAsync();

        Assert.Equal("a", Assert.Single(await client.NextSnapshotAsync()).Id);
    }
}
