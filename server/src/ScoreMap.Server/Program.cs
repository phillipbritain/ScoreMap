using System.Net;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Options;
using ScoreMap.Server.GameFeed;
using ScoreMap.Server.Games;
using ScoreMap.Server.Hubs;
using ScoreMap.Server.Live;
using ScoreMap.Server.Venues;
using ScoreMap.Server.WatchLinks;

var builder = WebApplication.CreateBuilder(args);

// Bound league by league at startup, so a misconfigured league (e.g. an unknown sport) stops the
// server straight away; binding the whole list at once would quietly skip it.
builder.Services.AddOptions<List<League>>()
    .Configure(leagues => leagues.AddRange(builder.Configuration.GetSection("Leagues").GetChildren()
        .Select(section => section.Get<League>() ?? throw new InvalidOperationException($"League {section.Path} is empty"))))
    .ValidateOnStart();
builder.Services.AddSingleton(TimeProvider.System);

// Game feed provider: ESPN's unofficial scoreboard (ADR-0001).
builder.Services.AddHttpClient(nameof(EspnGameFeedProvider), client =>
{
    client.BaseAddress = new Uri(builder.Configuration["Espn:BaseUrl"] ?? "https://site.api.espn.com/apis/site/v2/sports/");
    client.Timeout = TimeSpan.FromSeconds(10);
}).ConfigurePrimaryHttpMessageHandler(() => new SocketsHttpHandler
{
    AutomaticDecompression = DecompressionMethods.All,
    PooledConnectionLifetime = TimeSpan.FromMinutes(5),
});
builder.Services.AddSingleton<IGameFeedProvider>(sp => new EspnGameFeedProvider(
    sp.GetRequiredService<IHttpClientFactory>().CreateClient(nameof(EspnGameFeedProvider)),
    sp.GetRequiredService<TimeProvider>()));

// Venue locator, with OpenStreetMap Nominatim as its place search. The place search is a
// singleton so its rate limit holds across the whole app.
builder.Services.AddOptions<VenueOptions>()
    .Bind(builder.Configuration.GetSection("Venues"))
    .PostConfigure<IConfiguration>((options, config) =>
    {
        // On Azure App Service only HOME (/home) is writable and kept across restarts and
        // redeploys, so a relative saved-lookups path is taken from there instead.
        if (config["WEBSITE_SITE_NAME"] is not null && config["HOME"] is { } home)
            options.SavedLocationsPath = Path.Combine(home, options.SavedLocationsPath);
    });
builder.Services.Configure<NominatimOptions>(builder.Configuration.GetSection("Nominatim"));
builder.Services.AddHttpClient(nameof(NominatimPlaceSearch), (sp, client) =>
{
    client.BaseAddress = sp.GetRequiredService<IOptions<NominatimOptions>>().Value.BaseUrl;
    client.Timeout = TimeSpan.FromSeconds(10);
}).ConfigurePrimaryHttpMessageHandler(() => new SocketsHttpHandler
{
    PooledConnectionLifetime = TimeSpan.FromMinutes(5),
});
builder.Services.AddSingleton<IPlaceSearch>(sp => new NominatimPlaceSearch(
    sp.GetRequiredService<IHttpClientFactory>().CreateClient(nameof(NominatimPlaceSearch)),
    sp.GetRequiredService<TimeProvider>(),
    sp.GetRequiredService<IOptions<NominatimOptions>>()));
builder.Services.AddSingleton<VenueLocator>();

// Official watch links, from the owner's watch links file.
builder.Services.Configure<WatchLinkOptions>(builder.Configuration.GetSection("WatchLinks"));
builder.Services.AddSingleton<OfficialWatchLinks>();

// Unofficial stream links: no game has any unless the stream finder is added (ADR-0002: hobby v1
// only; delete this AddStreamFinder line and the StreamFinder*.cs files before any public launch).
builder.Services.AddStreamFinder(builder.Configuration);
builder.Services.TryAddSingleton<IStreamLinkSource, NoStreamLinks>();

builder.Services.AddSingleton<GameBoard>();

// Live updates: the poller fetches while browsers are connected and pushes change events.
builder.Services.AddSingleton<BrowserConnections>();
builder.Services.AddSingleton<Poller>();
builder.Services.AddHostedService(sp => sp.GetRequiredService<Poller>());
builder.Services.AddSignalR();

var app = builder.Build();

// The built browser app (wwwroot, filled by `dotnet publish`; in development Vite serves it
// instead). Any page address that isn't a file or the hub gets index.html.
app.UseDefaultFiles();
app.UseStaticFiles();
app.MapHub<GamesHub>(GamesHub.Path);
app.MapFallbackToFile("index.html");

// The configured leagues in order, so the browser's filter can list every league, even one with no games now.
app.MapGet("/api/leagues", (IOptions<List<League>> leagues) =>
    leagues.Value.Select(league => new { league.Name, Sport = league.Sport.DisplayName() }));

app.Run();

/// <summary>Exposed so tests can start the server with WebApplicationFactory.</summary>
public partial class Program;
