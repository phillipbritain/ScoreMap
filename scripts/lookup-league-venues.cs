// Makes the checked-in live league venue lookups, so a cold start (a first deploy, or a wiped data/
// folder) places the live leagues' games at once instead of waiting on Nominatim. Reads ESPN's
// scoreboards for every league in server/src/ScoreMap.Server/appsettings.json, day by day over a span of
// dates, through the server's own ESPN feed, so the venues, cities and home cities are exactly those the
// live server asks about. Each query the venue locator would ask that league-venue-locations.json
// doesn't have yet is asked of Nominatim, at most once every 1.5 s as its usage policy asks, and the
// answer (a miss as null) is added to the file. Run it by hand now and then, say at the start of a
// season, then check the file in:
//
//     dotnet run scripts/lookup-league-venues.cs                            # 30 days back to 30 ahead
//     dotnet run scripts/lookup-league-venues.cs -- 2026-09-01 2026-12-31   # from, to (inclusive)
//
// It only adds: every lookup already in the file is kept, so runs over different spans build up the
// list. To redo every lookup, delete the file first. Queries Nominatim failed on (not "not found", but an
// error or timeout) are listed at the end and left out, so the next run asks them again; it exits with 1
// while there are any. The server never runs this: ESPN and Nominatim are only asked here, by hand.
#:sdk Microsoft.NET.Sdk.Web
#:property PublishAot=false
#:project ../server/src/ScoreMap.Server/ScoreMap.Server.csproj

using System.Globalization;
using System.Net;
using Microsoft.Extensions.Options;
using ScoreMap.Server.GameFeed;
using ScoreMap.Server.Venues;

var serverProject = Path.GetFullPath(Path.Combine(AppContext.GetData("EntryPointFileDirectoryPath") as string
    ?? throw new InvalidOperationException("Run with `dotnet run scripts/lookup-league-venues.cs`"),
    "..", "server", "src", "ScoreMap.Server"));
var leagueKeys = new ConfigurationBuilder()
    .AddJsonFile(Path.Combine(serverProject, "appsettings.json"))
    .Build()
    .GetSection("Leagues").GetChildren()
    .Select(league => league["Key"] ?? throw new InvalidOperationException($"League {league.Path} has no key"))
    .ToList();

var today = DateOnly.FromDateTime(DateTime.UtcNow);
var (from, to) = args switch
{
    [] => (today.AddDays(-30), today.AddDays(30)),
    [var first, var last] => (DateOnly.Parse(first, CultureInfo.InvariantCulture), DateOnly.Parse(last, CultureInfo.InvariantCulture)),
    _ => throw new ArgumentException("Pass no dates, or a first and last date: 2026-09-01 2026-12-31"),
};

using var stop = new CancellationTokenSource();
Console.CancelKeyPress += (_, e) => { e.Cancel = true; stop.Cancel(); };

// The feed asks for the day its clock is on and the day before (ESPN's days are US Eastern), so a clock
// at noon Eastern every other day covers each day once. IndyCar is left out: its races come with their
// track's position (indycar-tracks.json), so they never need a lookup.
var clock = new SettableClock();
using var espn = new HttpClient(new SocketsHttpHandler { AutomaticDecompression = DecompressionMethods.All })
{
    BaseAddress = new Uri("https://site.api.espn.com/apis/site/v2/sports/"),
    Timeout = TimeSpan.FromSeconds(30),
};
var feed = new EspnGameFeedProvider(espn, clock);
var eastern = TimeZoneInfo.FindSystemTimeZoneById("America/New_York");
var games = new Dictionary<string, ProviderGame>();
for (var day = from.AddDays(1); day <= to.AddDays(1); day = day.AddDays(2))
{
    var noon = day.ToDateTime(new TimeOnly(12, 0));
    clock.Now = new DateTimeOffset(noon, eastern.GetUtcOffset(noon));
    foreach (var league in leagueKeys)
    {
        try
        {
            foreach (var game in await feed.FetchScoreboardAsync(league, stop.Token))
                games.TryAdd($"{league}/{game.Id}", game);
        }
        catch (Exception ex) when (!stop.IsCancellationRequested)
        {
            Console.WriteLine($"ESPN failed for {league} on {day.AddDays(-1)}..{day}: {ex.Message}");
        }
    }
    Console.WriteLine($"Read ESPN to {day}: {games.Count} game(s) so far.");
}

var options = new NominatimOptions();
using var http = new HttpClient { BaseAddress = options.BaseUrl, Timeout = TimeSpan.FromSeconds(10) };
var nominatim = new LoggingPlaceSearch(new NominatimPlaceSearch(http, TimeProvider.System, Options.Create(options)));

var failed = await LeagueVenueLookup.UpdateAsync(
    games.Values, Path.Combine(serverProject, "league-venue-locations.json"), nominatim, stop.Token);

Console.WriteLine($"Looked up {nominatim.Count} new query(s) for {games.Count} game(s).");
foreach (var query in failed)
    Console.WriteLine($"FAILED: {query}");
return failed.Count == 0 ? 0 : 1;

/// <summary>The clock the feed picks its scoreboard days by, moved along the span by hand.</summary>
sealed class SettableClock : TimeProvider
{
    public DateTimeOffset Now { get; set; }

    public override DateTimeOffset GetUtcNow() => Now;
}

/// <summary>Prints each query as it is asked, since a full run takes many minutes.</summary>
sealed class LoggingPlaceSearch(IPlaceSearch inner) : IPlaceSearch
{
    public int Count { get; private set; }

    public async Task<Coordinates?> SearchAsync(string query, CancellationToken cancellationToken)
    {
        Count++;
        var found = await inner.SearchAsync(query, cancellationToken);
        Console.WriteLine($"{query}: {(found is null ? "not found" : $"{found.Latitude}, {found.Longitude}")}");
        return found;
    }
}
