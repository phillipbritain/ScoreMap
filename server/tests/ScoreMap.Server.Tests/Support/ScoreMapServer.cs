using System.Text.Json;
using System.Threading.Channels;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http.Connections;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.SignalR.Client;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Time.Testing;
using ScoreMap.Server.GameFeed;
using ScoreMap.Server.Games;
using ScoreMap.Server.Hubs;
using ScoreMap.Server.Live;
using ScoreMap.Server.Scenarios;
using ScoreMap.Server.Venues;
using ScoreMap.Server.WatchLinks;

namespace ScoreMap.Server.Tests.Support;

/// <summary>
/// The main test seam: the real server, started with fakes for its outside
/// dependencies. Tests drive the fakes and assert only on what a connected
/// client receives.
/// </summary>
public sealed class ScoreMapServer(
    string? savedVenueLocationsPath = null, bool useShippedWatchLinks = false, string? savedVenuePhotosPath = null)
    : WebApplicationFactory<Program>
{
    private readonly bool _ownsSavedVenueLocations = savedVenueLocationsPath is null;
    private readonly bool _ownsSavedVenuePhotos = savedVenuePhotosPath is null;

    public FakeGameFeedProvider Feed { get; } = new();

    public FakePlaceSearch Places { get; } = new();

    /// <summary>Everything the server logs.</summary>
    public CapturedLogs Logs { get; } = new();

    /// <summary>
    /// The file the server saves venue lookups to. A fresh temp file unless one is passed in,
    /// so a second server can be started over the first one's saved lookups.
    /// </summary>
    public string SavedVenueLocationsPath { get; } =
        savedVenueLocationsPath ?? Path.Combine(Path.GetTempPath(), $"scoremap-venues-{Guid.NewGuid():N}.json");

    public FakeVenuePhotoSearch Photos { get; } = new();

    /// <summary>
    /// The checked-in scenario venue lookups the server reads: a fresh temp path, so tests don't
    /// see the repo's file (unless <see cref="UseShippedScenarios"/>). Empty until a test writes it.
    /// </summary>
    public string ScenarioVenueLocationsPath { get; } =
        Path.Combine(Path.GetTempPath(), $"scoremap-scenario-venue-locations-{Guid.NewGuid():N}.json");

    /// <summary>
    /// The file the server saves venue photos to. A fresh temp file unless one is passed in,
    /// so a second server can be started over the first one's saved photos.
    /// </summary>
    public string SavedVenuePhotosPath { get; } =
        savedVenuePhotosPath ?? Path.Combine(Path.GetTempPath(), $"scoremap-photos-{Guid.NewGuid():N}.json");

    /// <summary>Waits until every venue photo search the server has started has finished.</summary>
    public Task PhotoSearchesFinishedAsync() =>
        Services.GetRequiredService<VenuePhotos>().SearchesFinishedAsync().WaitAsync(TimeSpan.FromSeconds(10));

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
    /// saved venue lookups and photos paths unconfigured so the server picks its App Service defaults.
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

    /// <summary>Stands in for the stream finder behind its seam, when a test sets it.</summary>
    public IStreamLinkSource? StreamLinkSource { get; init; }

    /// <summary>How long a stream site gets to answer, when a test sets it. Set before connecting.</summary>
    public TimeSpan? StreamSiteTimeout { get; set; }

    /// <summary>Waits until every stream search the server has started has finished.</summary>
    public Task StreamSearchesFinishedAsync() =>
        Services.GetRequiredService<StreamFinder>().SearchesFinishedAsync().WaitAsync(TimeSpan.FromSeconds(10));

    public FakeTimeProvider Clock { get; } = new(new DateTimeOffset(2026, 10, 4, 18, 0, 0, TimeSpan.Zero));

    private readonly List<(string Key, string Name, string Sport, TimeSpan? PlannedLength)> _extraLeagues = [];

    /// <summary>Configures one more league alongside those in appsettings.json. Call before connecting.</summary>
    public void AddLeague(string key, string name, string sport, TimeSpan? plannedLength = null) =>
        _extraLeagues.Add((key, name, sport, plannedLength));

    /// <summary>
    /// The scenario the server runs (ADR-0009), from <see cref="ScenariosFolder"/>. Unset, the server
    /// runs on real games (here, <see cref="Feed"/>) whatever appsettings.Development.json says.
    /// </summary>
    public string? Scenario { get; init; }

    /// <summary>The folder the server reads scenario files from: a fresh temp folder, written by <see cref="WriteScenario"/>.</summary>
    public string ScenariosFolder { get; } = Path.Combine(Path.GetTempPath(), $"scoremap-scenarios-{Guid.NewGuid():N}");

    /// <summary>
    /// Runs the server on the scenario settings, files and checked-in venue lookups that ship with
    /// it, rather than <see cref="Scenario"/>, <see cref="ScenariosFolder"/> and
    /// <see cref="ScenarioVenueLocationsPath"/>.
    /// </summary>
    public bool UseShippedScenarios { get; init; }

    /// <summary>The hosting environment to run in, when not Development (the default).</summary>
    public string? Environment { get; init; }

    /// <summary>Writes a scenario file, as the owner would. Call before connecting.</summary>
    public void WriteScenario(string name, string json)
    {
        Directory.CreateDirectory(ScenariosFolder);
        File.WriteAllText(Path.Combine(ScenariosFolder, $"{name}.json"), json);
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        // High indexes so they extend, rather than replace, the configured leagues.
        for (var i = 0; i < _extraLeagues.Count; i++)
        {
            builder.UseSetting($"Leagues:{100 + i}:Key", _extraLeagues[i].Key);
            builder.UseSetting($"Leagues:{100 + i}:Name", _extraLeagues[i].Name);
            builder.UseSetting($"Leagues:{100 + i}:Sport", _extraLeagues[i].Sport);
            if (_extraLeagues[i].PlannedLength is { } plannedLength)
                builder.UseSetting($"Leagues:{100 + i}:PlannedLength", plannedLength.ToString("c"));
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
            builder.UseSetting("Venues:SavedPhotosPath", SavedVenuePhotosPath);
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
        if (!UseShippedScenarios)
        {
            builder.UseSetting("Scenario", Scenario ?? "real");
            builder.UseSetting("Scenarios:Folder", ScenariosFolder);
            builder.UseSetting("Venues:ScenarioLocationsPath", ScenarioVenueLocationsPath);
        }
        if (Environment is not null)
            builder.UseEnvironment(Environment);
        builder.ConfigureLogging(logging =>
        {
            logging.AddProvider(Logs);
            logging.AddFilter<CapturedLogs>(null, LogLevel.Trace);
        });
        builder.ConfigureTestServices(services =>
        {
            // The fake stands in for ESPN: behind the scenario switcher, in Development.
            if (services.Any(d => d.ServiceType == typeof(ScenarioSwitcher)))
            {
                services.RemoveAllKeyed<IGameFeedProvider>(ScenarioSwitcher.RealGamesKey);
                services.AddKeyedSingleton<IGameFeedProvider>(ScenarioSwitcher.RealGamesKey, Feed);
            }
            else
            {
                services.RemoveAll<IGameFeedProvider>();
                services.AddSingleton<IGameFeedProvider>(Feed);
            }
            services.RemoveAll<IPlaceSearch>();
            services.AddSingleton<IPlaceSearch>(Places);
            services.RemoveAll<IVenuePhotoSearch>();
            services.AddSingleton<IVenuePhotoSearch>(Photos);
            services.AddHttpClient(StreamFinder.HttpClientName).ConfigurePrimaryHttpMessageHandler(() => StreamSites);
            if (StreamLinkSource is not null)
            {
                services.RemoveAll<IStreamLinkSource>();
                services.AddSingleton(StreamLinkSource);
            }
            services.RemoveAll<TimeProvider>();
            services.AddSingleton<TimeProvider>(Clock);
        });
    }

    public override async ValueTask DisposeAsync()
    {
        await base.DisposeAsync();
        if (_ownsSavedVenueLocations)
            File.Delete(SavedVenueLocationsPath);
        if (_ownsSavedVenuePhotos)
            File.Delete(SavedVenuePhotosPath);
        File.Delete(VenueCorrectionsPath);
        File.Delete(ScenarioVenueLocationsPath);
        File.Delete(WatchLinksPath);
        if (Directory.Exists(ScenariosFolder))
            Directory.Delete(ScenariosFolder, recursive: true);
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

    /// <summary>
    /// Closes the browser stand-in and waits until the server has seen it go. Call it once the
    /// client has its snapshot.
    /// </summary>
    public async Task DisconnectAsync(TestClient client)
    {
        var connections = Services.GetRequiredService<BrowserConnections>();
        var id = client.ConnectionId;
        // The hub counts a browser only once it has sent its snapshot, which the client can have first.
        await WaitUntilAsync(() => connections.IsConnected(id), "The server did not see the client connect");
        await client.DisposeAsync();
        await WaitUntilAsync(() => !connections.IsConnected(id), "The server did not see the client disconnect");
    }

    private static async Task WaitUntilAsync(Func<bool> condition, string timeoutMessage)
    {
        var deadline = DateTime.UtcNow.AddSeconds(10);
        while (!condition())
        {
            if (DateTime.UtcNow > deadline)
                throw new TimeoutException(timeoutMessage);
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

    private readonly Channel<string> _scenarioSwitches = Channel.CreateUnbounded<string>();

    /// <summary>The connection's id, the same as the hub's for it once started.</summary>
    public string ConnectionId =>
        connection.ConnectionId ?? throw new InvalidOperationException("The client hasn't connected");

    internal async Task StartAsync()
    {
        connection.On<IReadOnlyList<Game>>(GamesHub.SnapshotMessage, games => _snapshot.TrySetResult(games));
        connection.On<GameChange>(GamesHub.ChangeMessage, change => _changes.Writer.TryWrite(change));
        connection.On<string>(GamesHub.ScenarioSwitchedMessage, name => _scenarioSwitches.Writer.TryWrite(name));
        await connection.StartAsync();
    }

    /// <summary>The name of the scenario (or "real") the server next said it had switched to.</summary>
    public async Task<string> NextScenarioSwitchAsync() =>
        await _scenarioSwitches.Reader.ReadAsync().AsTask().WaitAsync(Timeout);

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
