using System.Threading.Channels;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http.Connections;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.SignalR.Client;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Time.Testing;
using ScoreMap.Server.GameFeed;
using ScoreMap.Server.Games;
using ScoreMap.Server.Hubs;
using ScoreMap.Server.Live;
using ScoreMap.Server.Venues;

namespace ScoreMap.Server.Tests.Support;

/// <summary>
/// The main test seam: the real server, started with fakes for its outside
/// dependencies. Tests drive the fakes and assert only on what a connected
/// client receives.
/// </summary>
public sealed class ScoreMapServer(string? savedVenueLocationsPath = null) : WebApplicationFactory<Program>
{
    private readonly bool _ownsSavedVenueLocations = savedVenueLocationsPath is null;

    public FakeGameFeedProvider Feed { get; } = new();

    public FakePlaceSearch Places { get; } = new();

    /// <summary>
    /// The file the server saves venue lookups to. A fresh temp file unless one is passed in,
    /// so a second server can be started over the first one's saved lookups.
    /// </summary>
    public string SavedVenueLocationsPath { get; } =
        savedVenueLocationsPath ?? Path.Combine(Path.GetTempPath(), $"scoremap-venues-{Guid.NewGuid():N}.json");

    public FakeTimeProvider Clock { get; } = new(new DateTimeOffset(2026, 10, 4, 18, 0, 0, TimeSpan.Zero));

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseSetting("Venues:SavedLocationsPath", SavedVenueLocationsPath);
        builder.ConfigureTestServices(services =>
        {
            services.RemoveAll<IGameFeedProvider>();
            services.AddSingleton<IGameFeedProvider>(Feed);
            services.RemoveAll<IPlaceSearch>();
            services.AddSingleton<IPlaceSearch>(Places);
            services.RemoveAll<TimeProvider>();
            services.AddSingleton<TimeProvider>(Clock);
        });
    }

    public override async ValueTask DisposeAsync()
    {
        await base.DisposeAsync();
        if (_ownsSavedVenueLocations)
            File.Delete(SavedVenueLocationsPath);
    }

    /// <summary>Connects a browser stand-in to the games hub.</summary>
    public async Task<TestClient> ConnectClientAsync()
    {
        var client = new TestClient(new HubConnectionBuilder()
            .WithUrl(new Uri(Server.BaseAddress, GamesHub.Path), options =>
            {
                options.Transports = HttpTransportType.LongPolling;
                options.HttpMessageHandlerFactory = _ => Server.CreateHandler();
            })
            .Build());
        await client.StartAsync();
        return client;
    }

    /// <summary>Closes the browser stand-in and waits until the server has seen it go.</summary>
    public async Task DisconnectAsync(TestClient client)
    {
        var connections = Services.GetRequiredService<BrowserConnections>();
        var before = connections.Count;
        await client.DisposeAsync();
        var deadline = DateTime.UtcNow.AddSeconds(10);
        while (connections.Count >= before)
        {
            if (DateTime.UtcNow > deadline)
                throw new TimeoutException("The server did not see the client disconnect");
            await Task.Delay(10);
        }
    }
}

/// <summary>A browser stand-in that records what the server sends it.</summary>
public sealed class TestClient(HubConnection connection) : IAsyncDisposable
{
    private static readonly TimeSpan Timeout = TimeSpan.FromSeconds(10);

    private readonly TaskCompletionSource<IReadOnlyList<Game>> _snapshot =
        new(TaskCreationOptions.RunContinuationsAsynchronously);

    private readonly Channel<GameChange> _changes = Channel.CreateUnbounded<GameChange>();

    internal async Task StartAsync()
    {
        connection.On<IReadOnlyList<Game>>(GamesHub.SnapshotMessage, games => _snapshot.TrySetResult(games));
        connection.On<GameChange>(GamesHub.ChangeMessage, change => _changes.Writer.TryWrite(change));
        await connection.StartAsync();
    }

    public Task<IReadOnlyList<Game>> NextSnapshotAsync() => _snapshot.Task.WaitAsync(Timeout);

    /// <summary>The next change event the server pushed, in the order they arrived.</summary>
    public async Task<GameChange> NextChangeAsync() =>
        await _changes.Reader.ReadAsync().AsTask().WaitAsync(Timeout);

    /// <summary>Change events received so far and not yet read.</summary>
    public IReadOnlyList<GameChange> PendingChanges()
    {
        var pending = new List<GameChange>();
        while (_changes.Reader.TryRead(out var change))
            pending.Add(change);
        return pending;
    }

    public ValueTask DisposeAsync() => connection.DisposeAsync();
}
