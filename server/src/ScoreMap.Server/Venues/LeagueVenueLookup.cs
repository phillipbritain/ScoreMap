using System.Text.Encodings.Web;
using System.Text.Json;
using ScoreMap.Server.GameFeed;

namespace ScoreMap.Server.Venues;

/// <summary>
/// Makes the checked-in live league venue lookups: asks the place search the queries the venue locator
/// would ask for each game's pin, in its order, until one finds a place, and adds each answer (misses
/// too, as null) to the lookups file. Run by <c>scripts/lookup-league-venues.cs</c> over games from
/// ESPN's scoreboards, never by the server.
/// </summary>
public static class LeagueVenueLookup
{
    // Unescaped, so venue names with accents or apostrophes stay readable in the checked-in file.
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web)
    {
        WriteIndented = true,
        Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping,
    };

    /// <summary>
    /// Adds the answers for <paramref name="games"/> that <paramref name="locationsPath"/> doesn't have
    /// yet, keeping every lookup already in it. A game whose venue comes with its position needs none.
    /// Returns the queries the place search failed on, which are left out of the file so the next run
    /// asks them again.
    /// </summary>
    public static async Task<IReadOnlyList<string>> UpdateAsync(
        IEnumerable<ProviderGame> games, string locationsPath, IPlaceSearch places, CancellationToken cancellationToken)
    {
        var locations = new SortedDictionary<string, Coordinates?>(ReadLocations(locationsPath), StringComparer.Ordinal);
        var failed = new List<string>();

        foreach (var game in games.Where(game => game.Venue?.Location is null))
        {
            foreach (var (query, _) in VenueLocator.Queries(game.Venue, (game.Contest as ProviderSides)?.Home))
            {
                if (failed.Contains(query))
                    break;
                if (!locations.TryGetValue(query, out var found))
                {
                    try
                    {
                        found = await places.SearchAsync(query, cancellationToken);
                    }
                    catch (Exception) when (!cancellationToken.IsCancellationRequested)
                    {
                        failed.Add(query);
                        break;
                    }
                    // Written as it goes, so a run that's stopped keeps what it found.
                    locations[query] = found;
                    await WriteLocationsAsync(locationsPath, locations, cancellationToken);
                }
                if (found is not null)
                    break;
            }
        }

        await WriteLocationsAsync(locationsPath, locations, cancellationToken);
        return failed;
    }

    private static Dictionary<string, Coordinates?> ReadLocations(string path) =>
        File.Exists(path)
            ? JsonSerializer.Deserialize<Dictionary<string, Coordinates?>>(File.ReadAllText(path), Json) ?? []
            : [];

    private static async Task WriteLocationsAsync(
        string path, SortedDictionary<string, Coordinates?> locations, CancellationToken cancellationToken)
    {
        var temp = path + ".tmp";
        await using (var file = File.Create(temp))
            await JsonSerializer.SerializeAsync(file, locations, Json, cancellationToken);
        File.Move(temp, path, overwrite: true);
    }
}
