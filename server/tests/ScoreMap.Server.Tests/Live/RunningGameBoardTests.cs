using System.Collections.Concurrent;
using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.DependencyInjection;
using ScoreMap.Server.Hubs;
using ScoreMap.Server.Live;
using ScoreMap.Server.Scenarios;
using ScoreMap.Server.Tests.Support;
using static ScoreMap.Server.Tests.Support.TestGames;

namespace ScoreMap.Server.Tests.Live;

public class RunningGameBoardTests
{
    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task A_failed_join_removes_partial_membership_and_cancels_work_when_no_viewer_remains(bool cleanupFails)
    {
        await using var server = new ScoreMapServer();
        server.Feed.Hold(Nfl);
        var delivery = new JoinDelivery { FailGroupAdd = true, FailGroupRemove = cleanupFails };
        using var board = server.CreateBoard(delivery);
        var joining = board.JoinAsync("viewer", CancellationToken.None);
        await server.Feed.WaitForFetchesAsync(Nfl, 1);
        var fetch = server.Feed.FetchToken(Nfl);

        var error = await Assert.ThrowsAsync<InvalidOperationException>(() => joining);

        Assert.Equal("Cannot join group", error.Message);
        Assert.Equal([GamesHub.SnapshotMessage, "add", "remove"], delivery.Calls);
        Assert.False(board.IsWatching("viewer"));
        Assert.True(fetch.IsCancellationRequested);
        await board.StopAsync(CancellationToken.None);
    }

    [Fact]
    public async Task A_viewer_is_counted_only_after_its_snapshot_and_group_membership_are_ready()
    {
        await using var server = new ScoreMapServer();
        server.Feed.SetScoreboard(Nfl, LiveGame(server.Clock, "game"));
        var delivery = new JoinDelivery { HoldGroupAdd = true };
        using var board = server.CreateBoard(delivery);
        var joining = board.JoinAsync("viewer", CancellationToken.None);
        try
        {
            await delivery.Adding.Task.WaitAsync(TimeSpan.FromSeconds(10), TestContext.Current.CancellationToken);
            Assert.Equal([GamesHub.SnapshotMessage, "add"], delivery.Calls);
            Assert.False(board.IsWatching("viewer"));
            delivery.Release.TrySetResult();
            await joining;
            Assert.True(board.IsWatching("viewer"));
            Assert.Equal("game", Assert.Single(board.Games).Id);
            board.Leave("viewer");
            Assert.False(board.IsWatching("viewer"));
        }
        finally
        {
            delivery.Release.TrySetResult();
            await board.StopAsync(CancellationToken.None);
        }
    }

    [Fact]
    public async Task A_board_without_controls_refuses_to_switch_scenarios()
    {
        await using var server = new ScoreMapServer { Environment = "Production" };
        var board = server.Services.GetRequiredService<RunningGameBoard>();

        var error = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            board.StartAfreshAsync("missing", null, CancellationToken.None));

        Assert.Equal("This board has no scenario controls", error.Message);
    }

    [Fact]
    public async Task A_board_without_controls_refuses_to_change_speed()
    {
        await using var server = new ScoreMapServer { Environment = "Production" };
        var board = server.Services.GetRequiredService<RunningGameBoard>();

        var error = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            board.ChangeSpeedAsync(Speed.Normal, CancellationToken.None));

        Assert.Equal("This board has no scenario controls", error.Message);
    }

    [Fact]
    public async Task A_board_without_controls_has_no_slow_start()
    {
        await using var server = new ScoreMapServer { Environment = "Production" };
        var board = server.Services.GetRequiredService<RunningGameBoard>();

        Assert.Equal(TimeSpan.Zero, board.SlowStart);
    }

    [Fact]
    public async Task Slow_start_follows_the_running_scenario_and_is_zero_on_real_games()
    {
        await using var server = new ScoreMapServer { Scenario = "slow" };
        server.WriteScenario("slow", """{ "slowStart": "12s", "games": [] }""");
        server.WriteScenario("quick", """{ "games": [] }""");
        var board = server.Services.GetRequiredService<RunningGameBoard>();

        Assert.Equal(TimeSpan.FromSeconds(12), board.SlowStart);
        await board.StartAfreshAsync("quick", null, CancellationToken.None);
        Assert.Equal(TimeSpan.Zero, board.SlowStart);
        await board.StartAfreshAsync("slow", null, CancellationToken.None);
        Assert.Equal(TimeSpan.FromSeconds(12), board.SlowStart);
        await board.StartAfreshAsync("real", null, CancellationToken.None);
        Assert.Equal(TimeSpan.Zero, board.SlowStart);
    }

    [Theory]
    [InlineData(false, false)]
    [InlineData(false, true)]
    [InlineData(true, false)]
    [InlineData(true, true)]
    public async Task Overlapping_controls_publish_coherent_listings_in_change_order_and_return_the_published_listing(
        bool firstChangesSpeed, bool secondChangesSpeed)
    {
        await using var server = new ScoreMapServer { Scenario = "playing" };
        server.WriteScenario("playing", """{ "timeline": { "length": "1h", "changes": [] }, "games": [] }""");
        server.WriteScenario("slow", """{ "timeline": { "length": "1h", "changes": [] }, "slowStart": "12s", "games": [] }""");
        var switcher = server.Services.GetRequiredService<ScenarioSwitcher>();
        var delivery = new JoinDelivery { HoldScenarioChange = true };
        var source = new BoardSource(switcher, switcher.BoardClock, switcher.Polling, switcher);
        using var board = ActivatorUtilities.CreateInstance<RunningGameBoard>(server.Services, source, delivery);
        var cancellationToken = TestContext.Current.CancellationToken;

        var first = firstChangesSpeed
            ? board.ChangeSpeedAsync(Speed.Fast, cancellationToken)
            : board.StartAfreshAsync("slow", Speed.Paused, cancellationToken);
        try
        {
            await delivery.Publishing.Task.WaitAsync(TimeSpan.FromSeconds(10), cancellationToken);
            var second = secondChangesSpeed
                ? board.ChangeSpeedAsync(Speed.Faster, cancellationToken)
                : board.StartAfreshAsync("real", Speed.Normal, cancellationToken);
            // These calls run up to their first await: the second change is waiting on the held publication.
            Assert.False(first.IsCompleted);
            Assert.False(second.IsCompleted);
            Assert.Equal(firstChangesSpeed ? "playing" : "slow", switcher.Running);
            Assert.Equal(firstChangesSpeed ? Speed.Fast : Speed.Paused, switcher.Speed);
            Assert.Empty(delivery.ScenarioChanges);
            server.Clock.Advance(TimeSpan.FromSeconds(10));
            delivery.Release.TrySetResult();

            var results = await Task.WhenAll(first, second).WaitAsync(TimeSpan.FromSeconds(10), cancellationToken);
            Assert.Equal(results, delivery.ScenarioChanges.ToArray());
            var initial = results[0];
            Assert.Equal((firstChangesSpeed ? "playing" : "slow", firstChangesSpeed ? "Fast" : "Paused", true,
                !firstChangesSpeed, ScenarioClock.StartsAt),
                (initial.Running, initial.Speed, initial.CanControlPlay, initial.StartsSlowly, initial.Clock.Reads));
            Assert.Equal(server.Clock.GetUtcNow().AddSeconds(-10), initial.Clock.At);
            var next = results[1];
            Assert.Equal((secondChangesSpeed ? initial.Running : "real", secondChangesSpeed ? "Faster" : "Normal",
                secondChangesSpeed, secondChangesSpeed && !firstChangesSpeed),
                (next.Running, next.Speed, next.CanControlPlay, next.StartsSlowly));
            Assert.Equal(server.Clock.GetUtcNow(), next.Clock.At);
            Assert.Equal(secondChangesSpeed
                ? ScenarioClock.StartsAt.AddSeconds(firstChangesSpeed ? 40 : 0)
                : server.Clock.GetUtcNow(), next.Clock.Reads);
            Assert.Equal(initial.Scenarios, next.Scenarios);
            Assert.Equal(Speed.All, initial.Speeds);
            Assert.Equal(Speed.All, next.Speeds);
            Assert.Equal([GamesHub.RealGamesGroup, GamesHub.RealGamesGroup], delivery.ScenarioGroups);
        }
        finally { delivery.Release.TrySetResult(); }
    }

    // A transport adapter at the module's SignalR seam, so failed/partial delivery is controllable.
    private sealed class JoinDelivery : IHubContext<GamesHub>, IHubClients, IGroupManager, IClientProxy
    {
        public bool FailGroupAdd { get; init; }
        public bool FailGroupRemove { get; init; }
        public bool HoldGroupAdd { get; init; }
        public bool HoldScenarioChange { get; init; }
        public ConcurrentQueue<ScenarioEndpoints.ScenarioListing> ScenarioChanges { get; } = new();
        public ConcurrentQueue<string> ScenarioGroups { get; } = new();
        public TaskCompletionSource Publishing { get; } = new(TaskCreationOptions.RunContinuationsAsynchronously);
        public ConcurrentQueue<string> Calls { get; } = new();
        public TaskCompletionSource Adding { get; } = new(TaskCreationOptions.RunContinuationsAsynchronously);
        public TaskCompletionSource Release { get; } = new(TaskCreationOptions.RunContinuationsAsynchronously);
        IHubClients IHubContext<GamesHub>.Clients => this;
        IGroupManager IHubContext<GamesHub>.Groups => this;
        public IClientProxy Client(string connectionId) => this;
        public IClientProxy Group(string groupName)
        {
            ScenarioGroups.Enqueue(groupName);
            return this;
        }

        public async Task SendCoreAsync(string method, object?[] args, CancellationToken cancellationToken = default)
        {
            // Initial game changes have no subscribed viewers; only record the snapshot hand-off.
            if (method == GamesHub.SnapshotMessage)
                Calls.Enqueue(method);
            if (method == GamesHub.ScenarioChangedMessage)
            {
                Publishing.TrySetResult();
                if (HoldScenarioChange)
                    await Release.Task.WaitAsync(cancellationToken);
                ScenarioChanges.Enqueue(Assert.IsType<ScenarioEndpoints.ScenarioListing>(Assert.Single(args)));
            }
        }

        public async Task AddToGroupAsync(string connectionId, string groupName, CancellationToken cancellationToken = default)
        {
            Calls.Enqueue("add");
            Adding.TrySetResult();
            if (FailGroupAdd)
                throw new InvalidOperationException("Cannot join group");
            if (HoldGroupAdd)
                await Release.Task.WaitAsync(cancellationToken);
        }

        public Task RemoveFromGroupAsync(string connectionId, string groupName, CancellationToken cancellationToken = default)
        {
            Calls.Enqueue("remove");
            if (FailGroupRemove)
                throw new InvalidOperationException("Cannot remove group");
            return Task.CompletedTask;
        }

        public IClientProxy All => throw new NotSupportedException();
        public IClientProxy AllExcept(IReadOnlyList<string> excludedConnectionIds) => throw new NotSupportedException();
        public IClientProxy Clients(IReadOnlyList<string> connectionIds) => throw new NotSupportedException();
        public IClientProxy GroupExcept(string groupName, IReadOnlyList<string> excludedConnectionIds) => throw new NotSupportedException();
        public IClientProxy Groups(IReadOnlyList<string> groupNames) => throw new NotSupportedException();
        public IClientProxy User(string userId) => throw new NotSupportedException();
        public IClientProxy Users(IReadOnlyList<string> userIds) => throw new NotSupportedException();
    }
}
