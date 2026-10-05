using System.Text.Json;
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
using ScoreMap.Server.WatchLinks;

namespace ScoreMap.Server.Tests.Support;

/// <summary>
/// The main test seam: the real server, started with fakes for its outside
/// dependencies. Tests drive the fakes and assert only on what a connected
/// client receives.
/// </summary>
public sealed class ScoreMapServer(string? savedVenueLocationsPath = null, bool useShippedWatchLinks = false)
    : WebApplicationFactory<Program>
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

    /// <summary>The owner's venue corrections file: a fresh temp file, written by <see cref="CorrectVenue"/>.</summary>
    public string VenueCorrectionsPath { get; } =
        Path.Combine(Path.GetTempPath(), $"scoremap-corrections-{Guid.NewGuid():N}.json");

    private readonly Dictionary<string, Coordinates> _corrections = new();

    /// <summary>Adds an entry to the corrections file, as the owner would by editing it.</summary>
    public void CorrectVenue(string venueName, Coordinates location)
    {
        _corrections[venueName] = location;
        File.WriteAllText(VenueCorrectionsPath, JsonSerializer.Serialize(_corrections,
            new JsonSerializerOptions(JsonSerializerDefaults.Web) { WriteIndented = true }));
    }

    /// <summary>
    /// The folder of built browser app files the server serves, standing in for wwwroot.
    /// Unset, the server has no browser app (as in development, where Vite serves it).
    /// </summary>
    public string? BrowserAppFolder { get; init; }

    /// <summary>
    /// Runs the server as Azure App Service would, with HOME set to this folder, and leaves the
    /// saved venue lookups path unconfigured so the server picks its App Service default.
    /// </summary>
    public string? AppServiceHome { get; init; }

    /// <summary>
    /// The owner's watch links file: a fresh temp file, written by <see cref="AddWatchLink"/>,
    /// unless the server was started with the watch links file that ships with ScoreMap.
    /// </summary>
    public string WatchLinksPath { get; } =
        Path.Combine(Path.GetTempPath(), $"scoremap-watch-links-{Guid.NewGuid():N}.json");

    private readonly List<object> _watchLinks = [];

    /// <summary>Adds an entry to the watch links file, as the owner would by editing it.</summary>
    public void AddWatchLink(string url, params string[] names)
    {
        _watchLinks.Add(new { names, url });
        File.WriteAllText(WatchLinksPath, JsonSerializer.Serialize(_watchLinks,
            new JsonSerializerOptions(JsonSerializerDefaults.Web) { WriteIndented = true }));
    }

    /// <summary>Made-up sites the unofficial stream finder reads; see <see cref="AddStreamSite"/>.</summary>
    public FakeStreamSites StreamSites { get; } = new();

    private readonly List<(string Name, string SearchUrl, string LinkPattern)> _streamSites = [];

    /// <summary>
    /// Adds a site to the stream finder's site list, as the owner would in configuration.
    /// Call before connecting.
    /// </summary>
    public void AddStreamSite(string name, string searchUrl, string linkPattern) =>
        _streamSites.Add((name, searchUrl, linkPattern));

    /// <summary>How long a stream site gets to answer, when a test sets it. Set before connecting.</summary>
    public TimeSpan? StreamSiteTimeout { get; set; }

    /// <summary>Waits until every stream search the server has started has finished.</summary>
    public Task StreamSearchesFinishedAsync() =>
        Services.GetRequiredService<StreamFinder>().SearchesFinishedAsync().WaitAsync(TimeSpan.FromSeconds(10));

    public FakeTimeProvider Clock { get; } = new(new DateTimeOffset(2026, 10, 4, 18, 0, 0, TimeSpan.Zero));

    private readonly List<(string Key, string Name, string Sport)> _extraLeagues = [];

    /// <summary>Configures one more league alongside those in appsettings.json. Call before connecting.</summary>
    public void AddLeague(string key, string name, string sport) => _extraLeagues.Add((key, name, sport));

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        // High indexes so they extend, rather than replace, the configured leagues.
        for (var i = 0; i < _extraLeagues.Count; i++)
        {
            builder.UseSetting($"Leagues:{100 + i}:Key", _extraLeagues[i].Key);
            builder.UseSetting($"Leagues:{100 + i}:Name", _extraLeagues[i].Name);
            builder.UseSetting($"Leagues:{100 + i}:Sport", _extraLeagues[i].Sport);
        }
        if (BrowserAppFolder is not null)
            builder.UseWebRoot(BrowserAppFolder);
        if (AppServiceHome is not null)
        {
            builder.UseSetting("WEBSITE_SITE_NAME", "scoremap-test");
            builder.UseSetting("HOME", AppServiceHome);
        }
        else
        {
            builder.UseSetting("Venues:SavedLocationsPath", SavedVenueLocationsPath);
        }
        for (var i = 0; i < _streamSites.Count; i++)
        {
            builder.UseSetting($"StreamFinder:Sites:{i}:Name", _streamSites[i].Name);
            builder.UseSetting($"StreamFinder:Sites:{i}:SearchUrl", _streamSites[i].SearchUrl);
            builder.UseSetting($"StreamFinder:Sites:{i}:LinkPattern", _streamSites[i].LinkPattern);
        }
        if (StreamSiteTimeout is { } timeout)
            builder.UseSetting("StreamFinder:TimeoutSeconds", timeout.TotalSeconds.ToString(System.Globalization.CultureInfo.InvariantCulture));
        builder.UseSetting("Venues:CorrectionsPath", VenueCorrectionsPath);
        if (!useShippedWatchLinks)
            builder.UseSetting("WatchLinks:Path", WatchLinksPath);
        builder.ConfigureTestServices(services =>
        {
            services.RemoveAll<IGameFeedProvider>();
            services.AddSingleton<IGameFeedProvider>(Feed);
            services.RemoveAll<IPlaceSearch>();
            services.AddSingleton<IPlaceSearch>(Places);
            services.AddHttpClient(StreamFinder.HttpClientName).ConfigurePrimaryHttpMessageHandler(() => StreamSites);
            services.RemoveAll<TimeProvider>();
            services.AddSingleton<TimeProvider>(Clock);
        });
    }

    public override async ValueTask DisposeAsync()
    {
        await base.DisposeAsync();
        if (_ownsSavedVenueLocations)
            File.Delete(SavedVenueLocationsPath);
        File.Delete(VenueCorrectionsPath);
        File.Delete(WatchLinksPath);
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

    /// <summary>
    /// Connects, takes the snapshot and disconnects, waiting until the server has seen the
    /// browser go so that no polling happens while the test then moves the clock.
    /// </summary>
    public async Task<IReadOnlyList<Game>> SnapshotOnceAsync()
    {
        var client = await ConnectClientAsync();
        var snapshot = await client.NextSnapshotAsync();
        await DisconnectAsync(client);
        return snapshot;
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
