using System.Net.Http.Json;
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
        await using var server = new ScoreMapServer { Scenario = "slow" };
        server.WriteScenario("slow", OneGame("\"slowStart\": \"12s\","));
        await using var client = await server.ConnectClientAsync();
        var snapshot = client.NextSnapshotAsync();

        // A second at a time, giving the server real time to act on each.
        var waited = TimeSpan.Zero;
        while (!snapshot.IsCompleted && waited < TimeSpan.FromSeconds(20))
        {
            server.Clock.Advance(TimeSpan.FromSeconds(1));
            waited += TimeSpan.FromSeconds(1);
            await Task.Delay(50);
        }

        Assert.Equal("a", Assert.Single(await snapshot).Id);
        // A second more, at most, if the server began its wait after the first step.
        Assert.InRange(waited, TimeSpan.FromSeconds(12), TimeSpan.FromSeconds(13));
    }

    [Fact]
    public async Task The_listing_says_whether_the_running_scenario_starts_slowly_so_the_browser_that_picks_it_can_reload()
    {
        await using var server = new ScoreMapServer { Scenario = "quick" };
        server.WriteScenario("quick", OneGame(""));
        server.WriteScenario("slow", OneGame("\"slowStart\": \"12s\","));
        using var http = server.CreateClient();

        Assert.False((await http.GetFromJsonAsync<ScenarioListing>("/api/scenarios"))?.StartsSlowly);
        var response = await http.PutAsJsonAsync("/api/scenarios/running", new { name = "slow" });

        Assert.True((await response.Content.ReadFromJsonAsync<ScenarioListing>())?.StartsSlowly);
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
