// Makes the checked-in scenario venue lookups (ADR-0009): asks Nominatim, at most once every 1.5 s
// as its usage policy asks, for each venue in server/src/ScoreMap.Server/scenario-venues.json that
// scenario-venue-locations.json doesn't have yet, and writes what it finds there. Run it after
// changing the venue list, then check both files in:
//
//     dotnet run scripts/lookup-scenario-venues.cs
//
// Venues it can't find are listed at the end and left out of the file; fix their name or city in
// the venue list and run it again. Exits with 1 while any are missing.
#:sdk Microsoft.NET.Sdk.Web
#:property PublishAot=false
#:project ../server/src/ScoreMap.Server/ScoreMap.Server.csproj

using Microsoft.Extensions.Options;
using ScoreMap.Server.Scenarios;
using ScoreMap.Server.Venues;

var serverProject = Path.GetFullPath(Path.Combine(AppContext.GetData("EntryPointFileDirectoryPath") as string
    ?? throw new InvalidOperationException("Run with `dotnet run scripts/lookup-scenario-venues.cs`"),
    "..", "server", "src", "ScoreMap.Server"));
var options = new NominatimOptions();
using var http = new HttpClient { BaseAddress = options.BaseUrl, Timeout = TimeSpan.FromSeconds(10) };
var nominatim = new LoggingPlaceSearch(new NominatimPlaceSearch(http, TimeProvider.System, Options.Create(options)));

using var stop = new CancellationTokenSource();
Console.CancelKeyPress += (_, e) => { e.Cancel = true; stop.Cancel(); };

var misses = await ScenarioVenueLookup.UpdateAsync(
    Path.Combine(serverProject, "scenario-venues.json"),
    Path.Combine(serverProject, "scenario-venue-locations.json"),
    nominatim,
    stop.Token);

Console.WriteLine($"Looked up {nominatim.Count} venue(s).");
foreach (var miss in misses)
    Console.WriteLine($"NOT FOUND: {miss.Venue.Name}, {miss.Venue.City}, {miss.Venue.Country}"
        + (miss.Error is null ? "" : $" ({miss.Error.GetType().Name}: {miss.Error.Message})"));
return misses.Count == 0 ? 0 : 1;

/// <summary>Prints each query as it is asked, since a full run takes minutes.</summary>
sealed class LoggingPlaceSearch(IPlaceSearch inner) : IPlaceSearch
{
    public int Count { get; private set; }

    public async Task<ScoreMap.Server.GameFeed.Coordinates?> SearchAsync(string query, CancellationToken cancellationToken)
    {
        Count++;
        var found = await inner.SearchAsync(query, cancellationToken);
        Console.WriteLine($"{query}: {(found is null ? "not found" : $"{found.Latitude}, {found.Longitude}")}");
        return found;
    }
}
