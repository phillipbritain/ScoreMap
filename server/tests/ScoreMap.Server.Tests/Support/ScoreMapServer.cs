using System.Text.Json;
using System.Threading.Channels;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http.Connections;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.SignalR;
using Microsoft.AspNetCore.SignalR.Client;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Microsoft.Extensions.Time.Testing;
using ScoreMap.Server.Feedback;
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

    /// <summary>Uses a real adapter over fake HTTP when a test exercises feed-to-browser behavior.</summary>
    public IGameFeedProvider? FeedProvider { get; init; }

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
    /// The checked-in live league venue lookups the server reads: a fresh temp path, so tests don't see
    /// the repo's file. Empty until a test writes it.
    /// </summary>
    public string LeagueVenueLocationsPath { get; } =
        Path.Combine(Path.GetTempPath(), $"scoremap-league-venue-locations-{Guid.NewGuid():N}.json");

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

    private readonly List<StreamSite> _streamSites = [];

    /// <summary>Exercises the shipped site configuration over fake HTTP.</summary>
    public bool UseShippedStreamSites { get; init; }

    /// <summary>
    /// Adds a site to the stream finder's site list, as the owner would in configuration.
    /// Call before connecting.
    /// </summary>
    public void AddStreamSite(string name, string searchUrl, string linkPattern) =>
        AddStreamSite(new StreamSite { Name = name, SearchUrl = searchUrl, LinkPattern = linkPattern });

    public void AddStreamSite(StreamSite site) => _streamSites.Add(site);

    /// <summary>Stands in for the stream finder behind its seam, when a test sets it.</summary>
    public IStreamLinkSource? StreamLinkSource { get; init; }

    /// <summary>How long a stream site gets to answer, when a test sets it. Set before connecting.</summary>
    public TimeSpan? StreamSiteTimeout { get; set; }

    /// <summary>Waits until every stream search the server has started has finished.</summary>
    public Task StreamSearchesFinishedAsync() =>
        Services.GetRequiredService<StreamFinder>().SearchesFinishedAsync().WaitAsync(TimeSpan.FromSeconds(10));

    /// <summary>The made-up GitHub the feedback sink files issues with, once it has a token.</summary>
    public FakeGitHub GitHub { get; } = new();

    /// <summary>
    /// The owner's GitHub token for filing feedback, when a test sets it. Unset, the server only logs
    /// the issues it would have filed.
    /// </summary>
    public string? FeedbackToken { get; init; }

    /// <summary>How long GitHub gets to answer, when a test sets it.</summary>
    public TimeSpan? FeedbackTimeout { get; init; }

    public FakeTimeProvider Clock { get; init; } = new(new DateTimeOffset(2026, 10, 4, 18, 0, 0, TimeSpan.Zero));

    private readonly List<(string Key, string Name, string Sport, TimeSpan? PlannedLength)> _extraLeagues = [];

    /// <summary>Configures one more league alongside those in appsettings.json. Call before connecting.</summary>
    public void AddLeague(string key, string name, string sport, TimeSpan? plannedLength = null) =>
        _extraLeagues.Add((key, name, sport, plannedLength));

    /// <summary>
    /// The scenario the server runs (ADR-0009), from <see cref="ScenariosFolder"/>. Unset, the server
    /// runs on real games (here, <see cref="Feed"/>) whatever appsettings.Development.json says.
    /// </summary>
    public string? Scenario { get; init; }

    /// <summary>The speed the scenario clock starts at (the "ScenarioSpeed" setting), when a test sets it.</summary>
    public string? ScenarioSpeed { get; init; }

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
        builder.UseSetting("Venues:SavedLocationsPath", SavedVenueLocationsPath);
        builder.UseSetting("Venues:SavedPhotosPath", SavedVenuePhotosPath);
        if (StreamSiteTimeout is { } timeout)
            builder.UseSetting("StreamFinder:TimeoutSeconds", timeout.TotalSeconds.ToString(System.Globalization.CultureInfo.InvariantCulture));
        if (FeedbackToken is not null)
            builder.UseSetting("Feedback:GitHubToken", FeedbackToken);
        if (FeedbackTimeout is { } feedbackTimeout)
            builder.UseSetting("Feedback:TimeoutSeconds", feedbackTimeout.TotalSeconds.ToString(System.Globalization.CultureInfo.InvariantCulture));
        // As in production (infra/main.bicep): each visitor's address from the proxy's X-Forwarded-For.
        builder.UseSetting("FORWARDEDHEADERS_ENABLED", "true");
        builder.UseSetting("Venues:CorrectionsPath", VenueCorrectionsPath);
        builder.UseSetting("Venues:LeagueLocationsPath", LeagueVenueLocationsPath);
        if (!useShippedWatchLinks)
            builder.UseSetting("WatchLinks:Path", WatchLinksPath);
        if (!UseShippedScenarios)
        {
            builder.UseSetting("Scenario", Scenario ?? "real");
            builder.UseSetting("Scenarios:Folder", ScenariosFolder);
            builder.UseSetting("Venues:ScenarioLocationsPath", ScenarioVenueLocationsPath);
        }
        if (ScenarioSpeed is not null)
            builder.UseSetting("ScenarioSpeed", ScenarioSpeed);
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
                services.AddKeyedSingleton<IGameFeedProvider>(ScenarioSwitcher.RealGamesKey, FeedProvider ?? Feed);
            }
            else
            {
                services.RemoveAll<IGameFeedProvider>();
                services.AddSingleton<IGameFeedProvider>(FeedProvider ?? Feed);
            }
            services.RemoveAll<IPlaceSearch>();
            services.AddSingleton<IPlaceSearch>(Places);
            services.RemoveAll<IVenuePhotoSearch>();
            services.AddSingleton<IVenuePhotoSearch>(Photos);
            if (!UseShippedStreamSites)
                services.PostConfigure<StreamFinderOptions>(settings => settings.Sites = _streamSites.ToList());
            services.AddHttpClient(StreamFinder.HttpClientName).ConfigurePrimaryHttpMessageHandler(() => StreamSites);
            services.AddHttpClient(GitHubFeedbackSink.HttpClientName).ConfigurePrimaryHttpMessageHandler(() => GitHub);
            if (StreamLinkSource is not null)
            {
                services.RemoveAll<IStreamLinkSource>();
                services.AddSingleton(StreamLinkSource);
            }
            services.RemoveAll<TimeProvider>();
            services.AddSingleton<TimeProvider>(Clock);
        });
    }

    /// <summary>Builds a board over the fake feed and clock, with controllable delivery.</summary>
    public RunningGameBoard CreateBoard(IHubContext<GamesHub> delivery)
    {
        var source = new BoardSource(FeedProvider ?? Feed, Clock,
            Services.GetRequiredService<IOptions<PollingOptions>>().Value, Controls: null);
        return ActivatorUtilities.CreateInstance<RunningGameBoard>(Services, source, delivery);
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
        File.Delete(LeagueVenueLocationsPath);
        File.Delete(WatchLinksPath);
        if (Directory.Exists(ScenariosFolder))
            Directory.Delete(ScenariosFolder, recursive: true);
    }

    /// <summary>Connects a browser stand-in to the games hub: to the real games, or to a demo's (ADR-0019).</summary>
    public async Task<TestClient> ConnectClientAsync(bool demo = false, WebApplicationFactory<Program>? app = null)
    {
        var host = app?.Server ?? Server;
        var path = demo ? $"{GamesHub.Path}?{GamesHub.DemoQuery}" : GamesHub.Path;
        var client = new TestClient(demo, new HubConnectionBuilder()
            .WithUrl(new Uri(host.BaseAddress, path), options =>
            {
                options.Transports = HttpTransportType.LongPolling;
                options.HttpMessageHandlerFactory = _ => host.CreateHandler();
            })
            .Build());
        await client.StartAsync();
        return client;
    }

    /// <summary>
    /// Connects, takes the snapshot and disconnects, waiting until the server has seen the
    /// browser go so that no polling happens while the test then moves the clock.
    /// </summary>
    public async Task<IReadOnlyList<Game>> SnapshotOnceAsync(bool demo = false)
    {
        var client = await ConnectClientAsync(demo);
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
        var connections = Services.GetRequiredService<RunningGameBoard>();
        var demo = Services.GetRequiredService<DemoBoard>();
        var id = client.ConnectionId;
        Func<bool> connected = client.Demo ? () => demo.IsWatching(id) : () => connections.IsWatching(id);
        // The hub counts a browser only once it has sent its snapshot, which the client can have first.
        await WaitUntilAsync(connected, "The server did not see the client connect");
        await client.DisposeAsync();
        await WaitUntilAsync(() => !connected(), "The server did not see the client disconnect");
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
public sealed class TestClient(bool demo, HubConnection connection) : IAsyncDisposable
{
    /// <summary>Whether the client watches a demo (ADR-0019) rather than the real games.</summary>
    public bool Demo { get; } = demo;

    private static readonly TimeSpan Timeout = TimeSpan.FromSeconds(10);

    private readonly TaskCompletionSource<IReadOnlyList<Game>> _snapshot =
        new(TaskCreationOptions.RunContinuationsAsynchronously);

    private readonly Channel<GameChange> _changes = Channel.CreateUnbounded<GameChange>();
    public bool ChangePrecededSnapshot { get; private set; }

    private readonly Channel<ScenarioEndpoints.ScenarioListing> _scenarioChanges =
        Channel.CreateUnbounded<ScenarioEndpoints.ScenarioListing>();

    /// <summary>The connection's id, the same as the hub's for it once started.</summary>
    public string ConnectionId =>
        connection.ConnectionId ?? throw new InvalidOperationException("The client hasn't connected");

    internal async Task StartAsync()
    {
        connection.On<IReadOnlyList<Game>>(GamesHub.SnapshotMessage, games => _snapshot.TrySetResult(games));
        connection.On<GameChange>(GamesHub.ChangeMessage, change =>
        {
            if (!_snapshot.Task.IsCompleted) ChangePrecededSnapshot = true;
            _changes.Writer.TryWrite(change);
        });
        connection.On<ScenarioEndpoints.ScenarioListing>(GamesHub.ScenarioChangedMessage, listing => _scenarioChanges.Writer.TryWrite(listing));
        await connection.StartAsync();
    }

    /// <summary>What the server next said about scenarios, after a switch or a change of speed.</summary>
    public async Task<ScenarioEndpoints.ScenarioListing> NextScenarioChangeAsync() =>
        await _scenarioChanges.Reader.ReadAsync().AsTask().WaitAsync(Timeout);

    public Task<IReadOnlyList<Game>> NextSnapshotAsync() => _snapshot.Task.WaitAsync(Timeout);

    private Dictionary<(string League, string Id), Game>? _observedGames;

    /// <summary>
    /// Observes the initial snapshot and subsequent changes until the requested game state arrives.
    /// Consumes changes through that point; raw snapshot and change methods retain their wire semantics.
    /// </summary>
    public async Task<IReadOnlyList<Game>> GamesMatchingAsync(Func<IReadOnlyList<Game>, bool> ready)
    {
        using var waiting = new CancellationTokenSource(Timeout);
        var snapshot = await _snapshot.Task.WaitAsync(waiting.Token);
        _observedGames ??= snapshot.ToDictionary(g => (g.League, g.Id));
        while (true)
        {
            var games = _observedGames.Values.ToArray();
            if (ready(games))
                return games;
            var change = await _changes.Reader.ReadAsync(waiting.Token);
            var key = (change.Game.League, change.Game.Id);
            if (change.Kind == GameChangeKind.Removed)
                _observedGames.Remove(key);
            else
                _observedGames[key] = change.Game;
        }
    }

    /// <summary>Waits for a particular game or its enrichment, consuming changes through its arrival.</summary>
    public async Task<Game> GameMatchingAsync(Func<Game, bool> ready) =>
        (await GamesMatchingAsync(games => games.Any(ready))).Single(ready);

    /// <summary>
    /// Waits until the client's one game has been placed, and returns it. Use for genuinely unknown
    /// venues: their searches may outlast the 250 ms snapshot budget and arrive in a later change.
    /// Corrections, given positions, scenario lookups and saved lookups are already in the snapshot. A placed venue
    /// has a position; one whose lookup is pending (or found nothing) has none.
    /// </summary>
    public async Task<Game> PlacedGameAsync() => Assert.Single(await PlacedGamesAsync(1));

    /// <summary>Waits until the client has received <paramref name="count"/> games, all placed (see <see cref="PlacedGameAsync"/>).</summary>
    public Task<IReadOnlyList<Game>> PlacedGamesAsync(int count) =>
        GamesMatchingAsync(games => games.Count == count && games.All(g => g.Venue.Latitude is not null));

    /// <summary>The next change event the server pushed, in the order they arrived.</summary>
    public async Task<GameChange> NextChangeAsync() =>
        await _changes.Reader.ReadAsync().AsTask().WaitAsync(Timeout);

    /// <summary>Waits until a change event not yet read has arrived, or <paramref name="within"/> has passed; true if one has.</summary>
    public async Task<bool> ChangeArrivedAsync(TimeSpan within)
    {
        try
        {
            return await _changes.Reader.WaitToReadAsync().AsTask().WaitAsync(within);
        }
        catch (TimeoutException)
        {
            return false;
        }
    }

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
