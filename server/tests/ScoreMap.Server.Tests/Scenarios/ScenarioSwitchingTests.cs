using System.Net;
using System.Net.Http.Json;
using ScoreMap.Server.Games;
using ScoreMap.Server.Tests.Support;
using static ScoreMap.Server.Tests.Support.TestGames;

namespace ScoreMap.Server.Tests.Scenarios;

public class ScenarioSwitchingTests
{
    private static string OneGame(string id, string status = "live") => $$"""
        {
          "games": [
            {
              "id": "{{id}}",
              "league": "NFL",
              "home": { "name": "Kansas City Chiefs", "abbreviation": "KC", "score": 14 },
              "away": { "name": "Buffalo Bills", "abbreviation": "BUF", "score": 10 },
              "venue": { "name": "Arrowhead Stadium", "city": "Kansas City", "region": "MO", "country": "USA" },
              "startsIn": "-40m",
              "status": "{{status}}"
            }
          ]
        }
        """;

    private sealed record ScenarioListing(string Running, string[] Scenarios);

    [Fact]
    public async Task Run_locally_the_server_lists_every_scenario_file_and_the_running_one()
    {
        await using var server = new ScoreMapServer { Scenario = "first" };
        server.WriteScenario("first", OneGame("a"));
        server.WriteScenario("second", OneGame("b"));
        using var http = server.CreateClient();

        var listing = await http.GetFromJsonAsync<ScenarioListing>("/api/scenarios");

        Assert.NotNull(listing);
        Assert.Equal("first", listing.Running);
        Assert.Equal(["first", "second"], listing.Scenarios);
    }

    [Fact]
    public async Task Switching_scenario_removes_the_old_games_and_adds_the_new_ones_in_every_browser()
    {
        await using var server = new ScoreMapServer { Scenario = "first" };
        server.WriteScenario("first", OneGame("a"));
        server.WriteScenario("second", OneGame("b"));
        using var http = server.CreateClient();
        await using var client = await server.ConnectClientAsync();
        Assert.Equal("a", Assert.Single(await client.NextSnapshotAsync()).Id);
        await using var other = await server.ConnectClientAsync();
        await other.NextSnapshotAsync();

        var response = await http.PutAsJsonAsync("/api/scenarios/running", new { name = "second" });

        response.EnsureSuccessStatusCode();
        Assert.Equal("second", (await response.Content.ReadFromJsonAsync<ScenarioListing>())?.Running);
        foreach (var browser in new[] { client, other })
        {
            var changes = new[] { await browser.NextChangeAsync(), await browser.NextChangeAsync() };
            Assert.Equivalent(
                new[] { (GameChangeKind.Removed, "a"), (GameChangeKind.Added, "b") },
                changes.Select(c => (c.Kind, c.Game.Id)));
        }
        Assert.Equal("second", (await http.GetFromJsonAsync<ScenarioListing>("/api/scenarios"))?.Running);
    }

    [Fact]
    public async Task Every_browser_is_told_which_scenario_is_now_running_so_its_pill_follows()
    {
        await using var server = new ScoreMapServer { Scenario = "first" };
        server.WriteScenario("first", OneGame("a"));
        server.WriteScenario("second", OneGame("b"));
        using var http = server.CreateClient();
        await using var client = await server.ConnectClientAsync();
        await client.NextSnapshotAsync();
        await using var other = await server.ConnectClientAsync();
        await other.NextSnapshotAsync();

        (await http.PutAsJsonAsync("/api/scenarios/running", new { name = "second" })).EnsureSuccessStatusCode();
        Assert.Equal("second", await client.NextScenarioSwitchAsync());
        Assert.Equal("second", await other.NextScenarioSwitchAsync());

        (await http.PutAsJsonAsync("/api/scenarios/running", new { name = "real" })).EnsureSuccessStatusCode();
        Assert.Equal("real", await other.NextScenarioSwitchAsync());
    }

    [Fact]
    public async Task Switching_to_real_games_fetches_them_at_the_real_intervals_and_switching_back_starts_the_scenario_afresh()
    {
        await using var server = new ScoreMapServer { Scenario = "first" };
        server.WriteScenario("first", OneGame("a"));
        server.Feed.SetScoreboard(Nfl, LiveGame(server.Clock, "real-game"));
        using var http = server.CreateClient();
        await using var client = await server.ConnectClientAsync();
        await client.NextSnapshotAsync();
        server.Clock.Advance(TimeSpan.FromMinutes(10));

        (await http.PutAsJsonAsync("/api/scenarios/running", new { name = "real" })).EnsureSuccessStatusCode();

        Assert.Equivalent(
            new[] { (GameChangeKind.Removed, "a"), (GameChangeKind.Added, "real-game") },
            new[] { await client.NextChangeAsync(), await client.NextChangeAsync() }.Select(c => (c.Kind, c.Game.Id)));
        Assert.Equal("real", (await http.GetFromJsonAsync<ScenarioListing>("/api/scenarios"))?.Running);
        // Live real games every 15 s, not a scenario's every second.
        server.Clock.Advance(TimeSpan.FromSeconds(14));
        await Task.Delay(100);
        Assert.Equal(1, server.Feed.Fetches(Nfl));
        server.Clock.Advance(TimeSpan.FromSeconds(1));
        await server.Feed.WaitForFetchesAsync(Nfl, 2);

        (await http.PutAsJsonAsync("/api/scenarios/running", new { name = "first" })).EnsureSuccessStatusCode();

        var changes = new[] { await client.NextChangeAsync(), await client.NextChangeAsync() };
        Assert.Equivalent(
            new[] { (GameChangeKind.Removed, "real-game"), (GameChangeKind.Added, "a") },
            changes.Select(c => (c.Kind, c.Game.Id)));
        Assert.Equal(server.Clock.GetUtcNow().AddMinutes(-40), changes.Single(c => c.Kind == GameChangeKind.Added).Game.StartTime);
    }

    [Fact]
    public async Task Started_on_real_games_the_server_can_switch_to_a_scenario_which_is_then_fetched_every_second()
    {
        await using var server = new ScoreMapServer();
        // Upcoming games get their pin 3 h before their start: this one 1 s after the scenario starts.
        server.WriteScenario("later", OneGame("later", status: "upcoming").Replace("-40m", "3h0m1s"));
        server.Feed.SetScoreboard(Nfl, LiveGame(server.Clock, "real-game"));
        using var http = server.CreateClient();
        await using var client = await server.ConnectClientAsync();
        Assert.Equal("real-game", Assert.Single(await client.NextSnapshotAsync()).Id);
        Assert.Equal("real", (await http.GetFromJsonAsync<ScenarioListing>("/api/scenarios"))?.Running);

        (await http.PutAsJsonAsync("/api/scenarios/running", new { name = "later" })).EnsureSuccessStatusCode();
        var removed = await client.NextChangeAsync();
        server.Clock.Advance(TimeSpan.FromSeconds(1));
        var added = await client.NextChangeAsync();

        Assert.Equal((GameChangeKind.Removed, "real-game"), (removed.Kind, removed.Game.Id));
        Assert.Equal((GameChangeKind.Added, "later"), (added.Kind, added.Game.Id));
    }

    [Theory]
    [InlineData("missing", HttpStatusCode.NotFound, "no scenario \\\"missing\\\"")]
    [InlineData("../first", HttpStatusCode.NotFound, "no scenario")]
    [InlineData("bad", HttpStatusCode.UnprocessableEntity, "unknown status")]
    public async Task A_switch_to_a_missing_or_bad_scenario_is_refused_and_the_running_one_carries_on(
        string name, HttpStatusCode status, string message)
    {
        await using var server = new ScoreMapServer { Scenario = "first" };
        server.WriteScenario("first", OneGame("a"));
        server.WriteScenario("bad", OneGame("b", status: "playing"));
        using var http = server.CreateClient();
        await using var client = await server.ConnectClientAsync();
        await client.NextSnapshotAsync();

        var response = await http.PutAsJsonAsync("/api/scenarios/running", new { name });

        Assert.Equal(status, response.StatusCode);
        Assert.Contains(message, await response.Content.ReadAsStringAsync());
        Assert.Equal("first", (await http.GetFromJsonAsync<ScenarioListing>("/api/scenarios"))?.Running);
        server.Clock.Advance(TimeSpan.FromSeconds(1));
        await Task.Delay(100);
        Assert.Empty(client.PendingChanges());
    }

    [Fact]
    public async Task Outside_development_the_server_lists_no_scenarios_and_refuses_a_switch()
    {
        await using var server = new ScoreMapServer { Scenario = "first", Environment = "Production" };
        server.WriteScenario("first", OneGame("a"));
        server.Feed.SetScoreboard(Nfl, LiveGame(server.Clock, "real-game"));
        using var http = server.CreateClient();
        await using var client = await server.ConnectClientAsync();
        await client.NextSnapshotAsync();

        var listing = await http.GetFromJsonAsync<ScenarioListing>("/api/scenarios");
        var response = await http.PutAsJsonAsync("/api/scenarios/running", new { name = "first" });

        Assert.NotNull(listing);
        Assert.Empty(listing.Scenarios);
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        await Task.Delay(100);
        Assert.Empty(client.PendingChanges());
    }
}
