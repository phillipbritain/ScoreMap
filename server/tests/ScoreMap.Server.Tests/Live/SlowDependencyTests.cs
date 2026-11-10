using System.Net.Http.Json;
using ScoreMap.Server.Scenarios;
using Microsoft.Extensions.DependencyInjection;
using ScoreMap.Server.GameFeed;
using ScoreMap.Server.Live;
using ScoreMap.Server.Venues;
using System.Text.Json;
using ScoreMap.Server.Tests.Support;
using static ScoreMap.Server.Tests.Support.TestGames;

namespace ScoreMap.Server.Tests.Live;

public class SlowDependencyTests
{
    [Theory]
    [InlineData(false, "saved")]
    [InlineData(true, "saved")]
    [InlineData(false, "scenario")]
    [InlineData(true, "scenario")]
    [InlineData(false, "correction")]
    [InlineData(true, "given")]
    [InlineData(false, "saved miss")]
    [InlineData(true, "saved miss")]
    public async Task Known_venues_are_placed_in_the_join_snapshot_while_an_earlier_unknown_is_held(bool anotherLeague, string source)
    {
        await using var server = new ScoreMapServer();
        var position = new Coordinates(51.6, -0.1);
        var venue = new ProviderVenue("Known Stadium", "London", null, null);
        if (source == "correction")
            server.CorrectVenue(venue.Name!, position);
        else if (source == "given")
            venue = venue with { Location = position };
        else
            File.WriteAllText(source == "scenario" ? server.ScenarioVenueLocationsPath : server.SavedVenueLocationsPath,
                JsonSerializer.Serialize(new Dictionary<string, Coordinates?>
                {
                    ["Known Stadium, London"] = source == "saved miss" ? null : position,
                    ["London"] = position,
                }, new JsonSerializerOptions(JsonSerializerDefaults.Web)));

        var unknownVenue = new ProviderVenue("Unknown Stadium", null, null, null);
        server.Places.Hold("Unknown Stadium");
        using var cancellation = new CancellationTokenSource();
        var pending = server.Services.GetRequiredService<VenueLocator>().LocateAsync(unknownVenue, null, cancellation.Token);
        try
        {
            Assert.False(pending.IsCompleted);
            var unknown = LiveGame(server.Clock, "unknown") with { Venue = unknownVenue };
            var known = LiveGame(server.Clock, "known") with { Venue = venue };
            if (anotherLeague)
            {
                server.Feed.SetScoreboard(Nfl, unknown);
                server.Feed.SetScoreboard("basketball/nba", known with { LeagueKey = "basketball/nba" });
            }
            else
                server.Feed.SetScoreboard(Nfl, unknown, known);

            await using var client = await server.ConnectClientAsync();
            var snapshot = await client.NextSnapshotAsync();
            var placed = Assert.Single(snapshot, g => g.Id == "known");
            Assert.Equal((51.6, -0.1), (placed.Venue.Latitude, placed.Venue.Longitude));
            Assert.Null(Assert.Single(snapshot, g => g.Id == "unknown").Venue.Latitude);
            Assert.False(client.ChangePrecededSnapshot);
        }
        finally
        {
            cancellation.Cancel();
            await Assert.ThrowsAnyAsync<OperationCanceledException>(() => pending);
        }
    }

    [Fact]
    public async Task Switching_source_cancels_old_fetches_before_publishing_the_new_source()
    {
        await using var server = new ScoreMapServer();
        server.WriteScenario("next", """{ "games": [] }""");
        server.Feed.Hold(Nfl);
        await using var client = await server.ConnectClientAsync();
        await server.Feed.WaitForFetchesAsync(Nfl, 1);
        await client.NextSnapshotAsync();
        var oldFetch = server.Feed.FetchToken(Nfl);

        var sourceWhenCanceled = new TaskCompletionSource<string>(TaskCreationOptions.RunContinuationsAsynchronously);
        var switcher = server.Services.GetRequiredService<ScenarioSwitcher>();
        using var canceled = oldFetch.Register(() => sourceWhenCanceled.TrySetResult(switcher.Running));
        using var http = server.CreateClient();

        (await http.PutAsJsonAsync("/api/scenarios/running", new { name = "next" }, TestContext.Current.CancellationToken)).EnsureSuccessStatusCode();

        Assert.Equal("real", await sourceWhenCanceled.Task.WaitAsync(TimeSpan.FromSeconds(10), TestContext.Current.CancellationToken));
        Assert.Equal("next", switcher.Running);
        Assert.True(oldFetch.IsCancellationRequested);
    }

    [Fact]
    public async Task A_stalled_league_does_not_block_snapshots_or_an_independent_leagues_changes()
    {
        await using var server = new ScoreMapServer();
        const string nba = "basketball/nba";
        server.Feed.SetScoreboard(Nfl, LiveGame(server.Clock, "slow"));
        server.Feed.HoldUntilReleased(Nfl);
        server.Feed.SetScoreboard(nba, LiveGame(server.Clock, "healthy"));
        await using var client = await server.ConnectClientAsync();
        var snapshot = await client.NextSnapshotAsync();
        Assert.Equal("healthy", Assert.Single(snapshot).Id);

        server.Feed.SetScoreboard(nba, LiveGame(server.Clock, "healthy", homeScore: 42));
        server.Clock.Advance(TimeSpan.FromSeconds(15));
        Assert.Equal("42", (await client.NextChangeAsync()).Game.Sides().Home.Score);

        server.Feed.Release(Nfl);
        Assert.Equal("slow", (await client.NextChangeAsync()).Game.Id);
        Assert.False(client.ChangePrecededSnapshot);
    }

    [Fact]
    public async Task A_pending_venue_delivers_basic_scores_then_moves_the_pin_when_the_lookup_finishes()
    {
        await using var server = new ScoreMapServer();
        const string query = "Slow Stadium, London";
        var started = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        server.Places.Add(query, new Coordinates(51.6, -0.1));
        server.Places.Hold(query);
        server.Places.OnSearch(query, () => started.TrySetResult());
        server.Feed.SetScoreboard(Nfl, LiveGame(server.Clock, "401") with
        {
            Venue = new ProviderVenue("Slow Stadium", "London", null, "England"),
        });
        await using var client = await server.ConnectClientAsync();
        await started.Task.WaitAsync(TimeSpan.FromSeconds(10), TestContext.Current.CancellationToken);
        var game = Assert.Single(await client.NextSnapshotAsync());
        Assert.Equal((null, null), (game.Venue.Latitude, game.Venue.Longitude));

        server.Feed.SetScoreboard(Nfl, LiveGame(server.Clock, "401", homeScore: 42) with
        {
            Venue = new ProviderVenue("Slow Stadium", "London", null, "England"),
        });
        server.Clock.Advance(TimeSpan.FromSeconds(15));
        Assert.Equal("42", (await client.NextChangeAsync()).Game.Sides().Home.Score);

        server.Places.Release(query);
        var moved = (await client.NextChangeAsync()).Game;
        Assert.Equal((51.6, -0.1), (moved.Venue.Latitude, moved.Venue.Longitude));
        Assert.Equal("42", moved.Sides().Home.Score);
        Assert.False(client.ChangePrecededSnapshot);
    }

    [Fact]
    public async Task Feed_concurrency_is_bounded_even_while_a_browser_gets_its_snapshot()
    {
        await using var server = new ScoreMapServer();
        server.Feed.HoldAllScoreboards();
        server.Feed.HoldTopEvents();
        await using var client = await server.ConnectClientAsync();
        await server.Feed.WaitForTotalFetchesAsync(4);
        Assert.Empty(await client.NextSnapshotAsync());
        Assert.Equal(4, server.Feed.TotalFetches);

        server.Feed.ReleaseTopEvents();
        await server.Feed.WaitForTotalFetchesAsync(5);
        Assert.Equal(5, server.Feed.TotalFetches);

        // Cancellation can free a slot before every queued worker observes its own cancellation.
        // Stop must drain them all while the number of simultaneous fetches stays bounded.
        await server.Services.GetRequiredService<RunningGameBoard>().StopAsync(CancellationToken.None);
        Assert.Equal(4, server.Feed.MaximumConcurrentFetches);
        Assert.Equal(0, server.Feed.ActiveFetches);
    }

    [Fact]
    public async Task A_stalled_top_events_request_does_not_suppress_games_and_marks_them_when_it_finishes()
    {
        await using var server = new ScoreMapServer();
        server.Feed.HoldTopEvents();
        server.Feed.SetTopEvents("401");
        server.Feed.SetScoreboard(Nfl, LiveGame(server.Clock, "401"));
        await using var client = await server.ConnectClientAsync();
        Assert.False(Assert.Single(await client.NextSnapshotAsync()).TopEvent);

        server.Feed.ReleaseTopEvents();
        Assert.True((await client.NextChangeAsync()).Game.TopEvent);
        Assert.False(client.ChangePrecededSnapshot);
    }

    [Fact]
    public async Task A_second_browser_gets_its_snapshot_before_a_pending_fetches_changes()
    {
        await using var server = new ScoreMapServer();
        server.Feed.SetScoreboard(Nfl, LiveGame(server.Clock, "401"));
        await using var first = await server.ConnectClientAsync();
        await first.NextSnapshotAsync();
        server.Feed.HoldUntilReleased(Nfl);
        server.Feed.SetScoreboard(Nfl, LiveGame(server.Clock, "401", homeScore: 42));
        server.Clock.Advance(TimeSpan.FromSeconds(15));
        await server.Feed.WaitForFetchesAsync(Nfl, 2);
        await using var second = await server.ConnectClientAsync();
        Assert.NotEqual("42", Assert.Single(await second.NextSnapshotAsync()).Sides().Home.Score);

        server.Feed.Release(Nfl);
        Assert.Equal("42", (await second.NextChangeAsync()).Game.Sides().Home.Score);
        Assert.False(second.ChangePrecededSnapshot);
    }
    [Fact]
    public async Task A_late_venue_lookup_does_not_restore_a_game_removed_from_the_board()
    {
        await using var server = new ScoreMapServer();
        const string query = "Slow Stadium, London";
        server.Places.Add(query, new Coordinates(51.6, -0.1));
        server.Places.Hold(query);
        server.Feed.SetScoreboard(Nfl, LiveGame(server.Clock, "401") with
        {
            Venue = new ProviderVenue("Slow Stadium", "London", null, "England"),
        });
        await using var first = await server.ConnectClientAsync();
        Assert.Single(await first.NextSnapshotAsync());
        server.Feed.SetScoreboard(Nfl);
        server.Clock.Advance(TimeSpan.FromSeconds(15));
        Assert.Equal(ScoreMap.Server.Games.GameChangeKind.Removed, (await first.NextChangeAsync()).Kind);

        server.Places.Release(query);
        await using var second = await server.ConnectClientAsync();
        Assert.Empty(await second.NextSnapshotAsync());
        Assert.Empty(first.PendingChanges());
    }
}
