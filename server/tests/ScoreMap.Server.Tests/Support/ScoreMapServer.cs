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
}

/// <summary>A browser stand-in that records what the server sends it.</summary>
public sealed class TestClient(HubConnection connection) : IAsyncDisposable
{
    private readonly TaskCompletionSource<IReadOnlyList<Game>> _snapshot =
        new(TaskCreationOptions.RunContinuationsAsynchronously);

    internal async Task StartAsync()
    {
        connection.On<IReadOnlyList<Game>>(GamesHub.SnapshotMessage, games => _snapshot.TrySetResult(games));
        await connection.StartAsync();
    }

    public Task<IReadOnlyList<Game>> NextSnapshotAsync() => _snapshot.Task.WaitAsync(TimeSpan.FromSeconds(10));

    public ValueTask DisposeAsync() => connection.DisposeAsync();
}
