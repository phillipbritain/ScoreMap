using System.Net;
using System.Net.Http.Json;
using ScoreMap.Server.Games;
using ScoreMap.Server.Scenarios;
using ScoreMap.Server.Tests.Support;
using static ScoreMap.Server.Tests.Support.TestGames;

namespace ScoreMap.Server.Tests.Scenarios;

/// <summary>The scenario clock and its speed (ADR-0009): a running scenario's games are on a clock that can run faster than real time.</summary>
public class ScenarioSpeedTests
{
    // One Live game that scores at 1m, on a timeline long enough not to loop in any test.
    private const string ScoresAtOneMinute = """
        {
          "games": [
            {
              "id": "chiefs-bills",
              "league": "NFL",
              "home": { "name": "Kansas City Chiefs", "abbreviation": "KC", "score": 14 },
              "away": { "name": "Buffalo Bills", "abbreviation": "BUF", "score": 10 },
              "venue": { "name": "Arrowhead Stadium", "city": "Kansas City", "region": "MO", "country": "USA" },
              "startsIn": "-40m",
              "status": "live"
            }
          ],
          "timeline": {
            "length": "1h",
            "changes": [
              { "at": "1m", "game": "chiefs-bills", "score": { "home": 21 } },
              { "at": "2m", "game": "chiefs-bills", "status": "final" }
            ]
          }
        }
        """;

    private const string SpeedPath = "/api/scenarios/speed";

    [Fact]
    public async Task The_listing_says_the_speed_the_speeds_to_choose_from_and_where_the_scenario_clock_is()
    {
        await using var server = new ScoreMapServer { Scenario = "test" };
        server.WriteScenario("test", ScoresAtOneMinute);
        using var http = server.CreateClient();

        var listing = await ListingAsync(http);

        Assert.Equal(1, listing.Speed);
        Assert.Equal([1, 2, 4, 8, 16, 32, 64], listing.Speeds);
        Assert.Equal(server.Clock.GetUtcNow(), listing.Clock.At);
        Assert.Equal(server.Clock.GetUtcNow(), listing.Clock.Reads);
    }

    [Fact]
    public async Task At_a_higher_speed_a_scripted_change_comes_that_many_times_sooner()
    {
        await using var server = new ScoreMapServer { Scenario = "test", ScenarioSpeed = "8" };
        server.WriteScenario("test", ScoresAtOneMinute);
        await using var client = await server.ConnectClientAsync();
        await client.NextSnapshotAsync();

        // 1m at 8× is 7.5 s.
        server.Clock.Advance(TimeSpan.FromSeconds(7));
        await Task.Delay(100);
        Assert.Empty(client.PendingChanges());
        server.Clock.Advance(TimeSpan.FromMilliseconds(500));
        var scored = await client.NextChangeAsync();

        Assert.Equal((GameChangeKind.ScoreChanged, 21), (scored.Kind, scored.Game.Home.Score));
    }

    [Fact]
    public async Task A_speed_change_carries_on_from_where_the_scenario_is_in_every_browser()
    {
        await using var server = new ScoreMapServer { Scenario = "test" };
        server.WriteScenario("test", ScoresAtOneMinute);
        var startedAt = server.Clock.GetUtcNow();
        using var http = server.CreateClient();
        await using var client = await server.ConnectClientAsync();
        await client.NextSnapshotAsync();
        await using var other = await server.ConnectClientAsync();
        await other.NextSnapshotAsync();
        server.Clock.Advance(TimeSpan.FromSeconds(20));

        var response = await http.PutAsJsonAsync(SpeedPath, new { speed = 4 });

        response.EnsureSuccessStatusCode();
        var listing = await response.Content.ReadFromJsonAsync<ScenarioEndpoints.ScenarioListing>();
        Assert.NotNull(listing);
        Assert.Equal(4, listing.Speed);
        Assert.Equal((server.Clock.GetUtcNow(), startedAt.AddSeconds(20)), (listing.Clock.At, listing.Clock.Reads));
        foreach (var browser in new[] { client, other })
            Assert.Equal(listing, await browser.NextScenarioChangeAsync(), ListingComparer.Instance);
        Assert.Equal(4, (await ListingAsync(http)).Speed);

        // The other 40 s to the score take 10 s at 4×, and the game carries on rather than starting again.
        server.Clock.Advance(TimeSpan.FromSeconds(9.75));
        await Task.Delay(100);
        Assert.Empty(client.PendingChanges());
        server.Clock.Advance(TimeSpan.FromSeconds(0.25));
        var scored = await client.NextChangeAsync();
        Assert.Equal((GameChangeKind.ScoreChanged, "chiefs-bills"), (scored.Kind, scored.Game.Id));
        Assert.Empty(client.PendingChanges());
    }

    [Fact]
    public async Task Switching_scenarios_or_picking_the_running_one_again_keeps_the_speed_and_starts_the_clock_at_the_real_time()
    {
        await using var server = new ScoreMapServer { Scenario = "test", ScenarioSpeed = "16" };
        server.WriteScenario("test", ScoresAtOneMinute);
        server.WriteScenario("other", ScoresAtOneMinute.Replace("chiefs-bills", "other-game"));
        using var http = server.CreateClient();
        server.Clock.Advance(TimeSpan.FromSeconds(10));

        foreach (var name in new[] { "test", "other" })
        {
            var response = await http.PutAsJsonAsync("/api/scenarios/running", new { name });

            var listing = await response.Content.ReadFromJsonAsync<ScenarioEndpoints.ScenarioListing>();
            Assert.NotNull(listing);
            Assert.Equal(16, listing.Speed);
            Assert.Equal((server.Clock.GetUtcNow(), server.Clock.GetUtcNow()), (listing.Clock.At, listing.Clock.Reads));
        }
    }

    [Fact]
    public async Task Game_starts_and_pin_windows_are_on_the_scenario_clock()
    {
        await using var server = new ScoreMapServer { Scenario = "test", ScenarioSpeed = "64" };
        // Upcoming games get their pin 3 h before their start: this one 64 s in, 1 s of real time at 64×.
        server.WriteScenario("test", """
            {
              "games": [
                {
                  "id": "later",
                  "league": "Premier League",
                  "home": { "name": "Arsenal", "abbreviation": "ARS" },
                  "away": { "name": "Chelsea", "abbreviation": "CHE" },
                  "venue": { "name": "Emirates Stadium", "city": "London", "country": "England" },
                  "startsIn": "3h1m4s",
                  "status": "upcoming"
                }
              ]
            }
            """);
        var startedAt = server.Clock.GetUtcNow();
        await using var client = await server.ConnectClientAsync();
        Assert.Empty(await client.NextSnapshotAsync());

        server.Clock.Advance(TimeSpan.FromMilliseconds(750));
        await Task.Delay(100);
        Assert.Empty(client.PendingChanges());
        server.Clock.Advance(TimeSpan.FromMilliseconds(250));
        var added = await client.NextChangeAsync();

        Assert.Equal((GameChangeKind.Added, "later"), (added.Kind, added.Game.Id));
        Assert.Equal(startedAt + new TimeSpan(3, 1, 4), added.Game.StartTime);
    }

    [Fact]
    public async Task A_game_ends_at_the_scenario_clocks_time()
    {
        await using var server = new ScoreMapServer { Scenario = "test", ScenarioSpeed = "4" };
        server.WriteScenario("test", ScoresAtOneMinute);
        var startedAt = server.Clock.GetUtcNow();
        await using var client = await server.ConnectClientAsync();
        await client.NextSnapshotAsync();

        // 2m at 4× is 30 s: a fetch just before (which sees the score at 1m), then one on the dot.
        server.Clock.Advance(TimeSpan.FromSeconds(29.75));
        await client.NextChangeAsync();
        server.Clock.Advance(TimeSpan.FromSeconds(0.25));
        var finished = await client.NextChangeAsync();

        Assert.Equal(GameChangeKind.Finished, finished.Kind);
        Assert.Equal(startedAt.AddMinutes(2), finished.Game.EndTime);
    }

    [Theory]
    [InlineData(1, 1000)]
    [InlineData(2, 500)]
    [InlineData(4, 250)]
    [InlineData(8, 250)]
    [InlineData(64, 250)]
    public async Task A_scenario_is_fetched_every_second_divided_by_the_speed_but_no_more_often_than_every_250_ms(int speed, int everyMs)
    {
        await using var server = new ScoreMapServer { Scenario = "test", ScenarioSpeed = speed.ToString() };
        server.WriteScenario("test", ScoresAtOneMinute.Replace("\"1m\"", "\"1s\""));
        await using var client = await server.ConnectClientAsync();
        await client.NextSnapshotAsync();

        // The score comes 1 s of scenario time in, and shows at the first fetch from then.
        server.Clock.Advance(TimeSpan.FromMilliseconds(everyMs - 1));
        await Task.Delay(100);
        Assert.Empty(client.PendingChanges());
        server.Clock.Advance(TimeSpan.FromMilliseconds(1));
        Assert.Equal(GameChangeKind.ScoreChanged, (await client.NextChangeAsync()).Kind);
    }

    [Fact]
    public async Task While_real_games_run_the_speed_cant_be_changed_and_the_clock_reads_the_real_time()
    {
        await using var server = new ScoreMapServer { Scenario = "test", ScenarioSpeed = "8" };
        server.WriteScenario("test", ScoresAtOneMinute);
        using var http = server.CreateClient();
        (await http.PutAsJsonAsync("/api/scenarios/running", new { name = "real" })).EnsureSuccessStatusCode();
        server.Clock.Advance(TimeSpan.FromSeconds(10));

        var response = await http.PutAsJsonAsync(SpeedPath, new { speed = 2 });

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        Assert.Contains("real time", await response.Content.ReadAsStringAsync());
        var listing = await ListingAsync(http);
        Assert.Equal(8, listing.Speed);
        Assert.Equal((server.Clock.GetUtcNow(), server.Clock.GetUtcNow()), (listing.Clock.At, listing.Clock.Reads));
    }

    [Fact]
    public async Task While_real_games_run_their_times_are_on_the_real_clock_whatever_the_speed()
    {
        await using var server = new ScoreMapServer { ScenarioSpeed = "64" };
        server.Feed.SetScoreboard(Nfl, UpcomingGame(server.Clock, "real-game") with { StartTime = server.Clock.GetUtcNow().AddHours(3).AddMinutes(4) });
        await using var client = await server.ConnectClientAsync();
        Assert.Empty(await client.NextSnapshotAsync());

        // A 3-minute quiet interval later, still a minute short of its pin window on the real clock.
        server.Clock.Advance(TimeSpan.FromMinutes(3));
        await server.Feed.WaitForFetchesAsync(Nfl, 2);
        await Task.Delay(100);

        Assert.Empty(client.PendingChanges());
    }

    [Theory]
    [InlineData(3)]
    [InlineData(0)]
    [InlineData(128)]
    public async Task A_speed_not_in_the_list_is_refused(int speed)
    {
        await using var server = new ScoreMapServer { Scenario = "test" };
        server.WriteScenario("test", ScoresAtOneMinute);
        using var http = server.CreateClient();

        var response = await http.PutAsJsonAsync(SpeedPath, new { speed });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Contains("1, 2, 4, 8, 16, 32, 64", await response.Content.ReadAsStringAsync());
        Assert.Equal(1, (await ListingAsync(http)).Speed);
    }

    [Fact]
    public async Task Outside_development_a_speed_change_is_refused()
    {
        await using var server = new ScoreMapServer { Scenario = "test", Environment = "Production" };
        server.WriteScenario("test", ScoresAtOneMinute);
        using var http = server.CreateClient();

        var response = await http.PutAsJsonAsync(SpeedPath, new { speed = 2 });

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task A_starting_speed_not_in_the_list_stops_the_server_from_starting()
    {
        await using var server = new ScoreMapServer { Scenario = "test", ScenarioSpeed = "5" };
        server.WriteScenario("test", ScoresAtOneMinute);

        var error = await Assert.ThrowsAnyAsync<Exception>(() => server.ConnectClientAsync());

        Assert.Contains("ScenarioSpeed", error.ToString());
        Assert.Contains("1, 2, 4, 8, 16, 32, 64", error.ToString());
    }

    private static async Task<ScenarioEndpoints.ScenarioListing> ListingAsync(HttpClient http) =>
        await http.GetFromJsonAsync<ScenarioEndpoints.ScenarioListing>("/api/scenarios")
        ?? throw new InvalidOperationException("No listing");

    /// <summary>Listings compared by value, lists included.</summary>
    private sealed class ListingComparer : IEqualityComparer<ScenarioEndpoints.ScenarioListing>
    {
        public static readonly ListingComparer Instance = new();

        public bool Equals(ScenarioEndpoints.ScenarioListing? x, ScenarioEndpoints.ScenarioListing? y) =>
            x is not null && y is not null && (x.Running, x.Speed, x.Clock) == (y.Running, y.Speed, y.Clock)
            && x.Scenarios.SequenceEqual(y.Scenarios) && x.Speeds.SequenceEqual(y.Speeds);

        public int GetHashCode(ScenarioEndpoints.ScenarioListing obj) => obj.Running.GetHashCode();
    }
}
