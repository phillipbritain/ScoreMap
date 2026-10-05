using System.Net;
using Microsoft.Extensions.Options;
using ScoreMap.Server.GameFeed;
using ScoreMap.Server.Games;
using ScoreMap.Server.Hubs;
using ScoreMap.Server.Venues;

var builder = WebApplication.CreateBuilder(args);

builder.Services.Configure<List<League>>(builder.Configuration.GetSection("Leagues"));
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
builder.Services.Configure<VenueOptions>(builder.Configuration.GetSection("Venues"));
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

builder.Services.AddSingleton<GameBoard>();
builder.Services.AddSignalR();

var app = builder.Build();

app.MapGet("/", () => "ScoreMap server");
app.MapHub<GamesHub>(GamesHub.Path);

app.Run();

/// <summary>Exposed so tests can start the server with WebApplicationFactory.</summary>
public partial class Program;
