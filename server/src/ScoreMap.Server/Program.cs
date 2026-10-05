using ScoreMap.Server.GameFeed;
using ScoreMap.Server.Games;
using ScoreMap.Server.Hubs;
using ScoreMap.Server.Venues;

var builder = WebApplication.CreateBuilder(args);

builder.Services.Configure<List<League>>(builder.Configuration.GetSection("Leagues"));
builder.Services.AddSingleton(TimeProvider.System);
builder.Services.AddSingleton<IGameFeedProvider, HardCodedGameFeedProvider>();
builder.Services.Configure<VenueOptions>(builder.Configuration.GetSection("Venues"));
builder.Services.AddSingleton<VenueLocator>();
builder.Services.AddSingleton<GameBoard>();
builder.Services.AddSignalR();

var app = builder.Build();

app.MapGet("/", () => "ScoreMap server");
app.MapHub<GamesHub>(GamesHub.Path);

app.Run();

/// <summary>Exposed so tests can start the server with WebApplicationFactory.</summary>
public partial class Program;
