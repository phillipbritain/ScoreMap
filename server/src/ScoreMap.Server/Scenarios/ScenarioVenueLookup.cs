using System.Text.Encodings.Web;
using System.Text.Json;
using ScoreMap.Server.GameFeed;
using ScoreMap.Server.Venues;

namespace ScoreMap.Server.Scenarios;

/// <summary>
/// Makes the checked-in scenario venue lookups (ADR-0009): looks every venue in the venue list up
/// through a place search and writes the positions found to the lookups file, keyed as the venue
/// locator asks for them. Run by <c>scripts/lookup-scenario-venues.cs</c>, never by the server.
/// </summary>
public static class ScenarioVenueLookup
{
    // Unescaped, so venue names with accents or apostrophes stay readable in the checked-in file.
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web)
    {
        WriteIndented = true,
        Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping,
    };

    /// <summary>
    /// Looks up the venues in <paramref name="venueListPath"/> that <paramref name="locationsPath"/>
    /// doesn't have yet, adding each one found, and drops lookups for venues no longer in the list.
    /// Returns the venues the place search couldn't find or failed on, which are left out of the
    /// file; a failed one is looked up again on the next run.
    /// </summary>
    public static async Task<IReadOnlyList<ScenarioVenueMiss>> UpdateAsync(
        string venueListPath, string locationsPath, IPlaceSearch places, CancellationToken cancellationToken)
    {
        var venues = ScenarioVenue.ReadList(venueListPath)
            .Select(venue => (Venue: venue, Query: VenueLocator.VenueQuery(venue.ToProviderVenue())))
            .ToList();
        var inList = venues.Select(v => v.Query).ToHashSet(StringComparer.Ordinal);
        var locations = new SortedDictionary<string, Coordinates>(
            ReadLocations(locationsPath).Where(saved => inList.Contains(saved.Key)).ToDictionary(),
            StringComparer.Ordinal);
        var misses = new List<ScenarioVenueMiss>();

        foreach (var (venue, query) in venues.Where(v => !locations.ContainsKey(v.Query)))
        {
            Coordinates? found;
            try
            {
                found = await places.SearchAsync(query, cancellationToken);
            }
            catch (Exception ex) when (!cancellationToken.IsCancellationRequested)
            {
                misses.Add(new(venue, ex));
                continue;
            }
            if (found is null)
            {
                misses.Add(new(venue, null));
                continue;
            }
            // Written as it goes, so a run that's stopped keeps what it found.
            locations[query] = found;
            await WriteLocationsAsync(locationsPath, locations, cancellationToken);
        }

        await WriteLocationsAsync(locationsPath, locations, cancellationToken);
        return misses;
    }

    private static Dictionary<string, Coordinates> ReadLocations(string path) =>
        File.Exists(path)
            ? JsonSerializer.Deserialize<Dictionary<string, Coordinates>>(File.ReadAllText(path), Json) ?? []
            : [];

    private static async Task WriteLocationsAsync(
        string path, SortedDictionary<string, Coordinates> locations, CancellationToken cancellationToken)
    {
        var temp = path + ".tmp";
        await using (var file = File.Create(temp))
            await JsonSerializer.SerializeAsync(file, locations, Json, cancellationToken);
        File.Move(temp, path, overwrite: true);
    }
}

/// <summary>A venue the lookup didn't find: the place search had no match, or failed with <see cref="Error"/>.</summary>
public sealed record ScenarioVenueMiss(ScenarioVenue Venue, Exception? Error);
