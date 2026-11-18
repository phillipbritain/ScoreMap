using System.Net.Http.Json;
using ScoreMap.Server.Live;
using ScoreMap.Server.Scenarios;
using ScoreMap.Server.Tests.Support;

namespace ScoreMap.Server.Tests.Live;

// Browsers decide which Upcoming games fill a globe with few games on by the board's time (ADR-0029),
// which in a scenario or a demo is the scenario clock's, not the real time.
public class BoardClockTests
{
    [Fact]
    public async Task A_viewer_of_real_games_is_sent_the_real_time()
    {
        await using var server = new ScoreMapServer();
        var now = server.Clock.GetUtcNow();

        await using var client = await server.ConnectClientAsync();

        Assert.Equal(new BoardClock(now, now, 1), await client.NextBoardClockAsync());
    }

    [Fact]
    public async Task A_viewer_of_a_scenario_is_sent_the_scenario_clock_and_its_speed()
    {
        await using var server = new ScoreMapServer { Scenario = "test", ScenarioSpeed = "Fast" };
        server.WriteScenario("test", """{ "games": [] }""");
        var now = server.Clock.GetUtcNow();

        await using var client = await server.ConnectClientAsync();

        Assert.Equal(new BoardClock(now, ScenarioClock.StartsAt, 4), await client.NextBoardClockAsync());
    }

    [Fact]
    public async Task A_change_of_speed_sends_every_viewer_the_clock_running_at_the_new_speed()
    {
        await using var server = new ScoreMapServer { Scenario = "test" };
        server.WriteScenario("test", """{ "timeline": { "length": "1h", "changes": [] }, "games": [] }""");
        using var http = server.CreateClient();
        await using var client = await server.ConnectClientAsync();
        await client.NextBoardClockAsync();
        server.Clock.Advance(TimeSpan.FromMinutes(2));

        (await http.PutAsJsonAsync("/api/scenarios/speed", new { speed = "Faster" }, TestContext.Current.CancellationToken)).EnsureSuccessStatusCode();

        Assert.Equal(
            new BoardClock(server.Clock.GetUtcNow(), ScenarioClock.StartsAt.AddMinutes(2), 32),
            await client.NextBoardClockAsync());
    }

    [Fact]
    public async Task A_demo_viewer_is_sent_the_demo_scenario_clock()
    {
        await using var server = new ScoreMapServer();
        server.WriteScenario(DemoBoard.Scenario, """{ "games": [] }""");
        var now = server.Clock.GetUtcNow();

        await using var client = await server.ConnectClientAsync(demo: true);

        Assert.Equal(new BoardClock(now, ScenarioClock.StartsAt, 1), await client.NextBoardClockAsync());
    }
}
