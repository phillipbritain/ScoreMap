using System.Text.Json;
using Microsoft.Extensions.Options;
using ScoreMap.Server.GameFeed;

namespace ScoreMap.Server.Venues;

/// <summary>A pin's position and which step of the venue locator found it.</summary>
public sealed record VenueLocation(Coordinates Location, LocationSource FoundBy);

public enum LocationSource
{
    /// <summary>The owner's corrections file.</summary>
    Correction,
    /// <summary>The position given with the venue (an IndyCar race's track list).</summary>
    Given,
    /// <summary>The venue, looked up by name and city.</summary>
    Venue,
    /// <summary>The centre of the venue's city.</summary>
    VenueCity,
    /// <summary>The home team's city, for a game with no usable venue.</summary>
    HomeTeamCity,
    /// <summary>Nothing worked; the position is 0,0.</summary>
    Nowhere,
}

/// <summary>
/// Resolves where a game's pin goes (see <see cref="LocateAsync"/>). Every place-search query is
/// asked once and its answer (misses too) saved to a file, so later runs never repeat a lookup.
/// Queries in the checked-in lookups, the scenario venues' (ADR-0009) and then the live leagues'
/// (made by scripts/lookup-league-venues.cs), are answered from those, before the saved lookups, and
/// never reach the place search.
/// </summary>
public sealed class VenueLocator
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web) { WriteIndented = true };

    private readonly IPlaceSearch _places;
    private readonly ILogger<VenueLocator> _logger;
    private readonly string _savedLocationsPath;
    private readonly VenueCorrections _corrections;
    private readonly string _scenarioLocationsPath;
    private readonly string _leagueLocationsPath;
    private readonly SemaphoreSlim _gate = new(1, 1);
    private readonly Lock _knownLock = new();
    private Dictionary<string, Coordinates?>? _saved;
    private Dictionary<string, Coordinates>? _scenarioLocations;
    private Dictionary<string, Coordinates?>? _leagueLocations;

    public VenueLocator(IPlaceSearch places, IOptions<VenueOptions> options, IHostEnvironment environment,
        ILogger<VenueLocator> logger)
    {
        _places = places;
        _logger = logger;
        _savedLocationsPath = Path.Combine(environment.ContentRootPath, options.Value.SavedLocationsPath);
        _scenarioLocationsPath = Path.Combine(environment.ContentRootPath, options.Value.ScenarioLocationsPath);
        _leagueLocationsPath = Path.Combine(environment.ContentRootPath, options.Value.LeagueLocationsPath);
        _corrections = new VenueCorrections(Path.Combine(environment.ContentRootPath, options.Value.CorrectionsPath), logger);
    }

    /// <summary>
    /// The position already known, including saved misses along the fallback chain, or 0,0 while
    /// a search is needed. Never waits for a search or a save.
    /// </summary>
    public VenueLocation Fallback(ProviderVenue? venue, ProviderTeam? home)
    {
        if (_corrections.Find(venue?.Name) is { } corrected)
            return new(corrected, LocationSource.Correction);
        if (venue?.Location is { } given)
            return new(given, LocationSource.Given);
        foreach (var (query, source) in Queries(venue, home))
        {
            if (!TryKnown(query, out var known))
                break;
            if (known is not null)
                return new(known, source);
        }
        return new(new Coordinates(0, 0), LocationSource.Nowhere);
    }

    /// <summary>
    /// Where a game's pin goes, trying in order: the corrections file, the position given with the venue,
    /// the venue looked up by name and city (ESPN supplies no coordinates, ADR-0001), the venue's city
    /// centre, and the home team's city
    /// (<paramref name="home"/>, null in a game with no home side).
    /// Always answers; when every step fails the position is 0,0 and <see cref="VenueLocation.FoundBy"/>
    /// says so.
    /// </summary>
    public async Task<VenueLocation> LocateAsync(ProviderVenue? venue, ProviderTeam? home, CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        if (_corrections.Find(venue?.Name) is { } corrected)
            return new(corrected, LocationSource.Correction);

        if (venue?.Location is { } given)
            return new(given, LocationSource.Given);

        foreach (var (query, source) in Queries(venue, home))
            if (await LookUpAsync(query, cancellationToken) is { } found)
                return new(found, source);

        _logger.LogWarning("No position found for venue {Venue} or home team {Team}; pinning at 0,0",
            venue?.Name, home?.FullName);
        return new(new Coordinates(0, 0), LocationSource.Nowhere);
    }

    /// <summary>
    /// The place-search queries for a game's pin, in the order they're tried after the corrections and a
    /// given position: the venue, its city, then the home team's city.
    /// </summary>
    public static IEnumerable<(string Query, LocationSource Source)> Queries(ProviderVenue? venue, ProviderTeam? home)
    {
        if (!string.IsNullOrWhiteSpace(venue?.Name))
            yield return (VenueQuery(venue), LocationSource.Venue);
        if (!string.IsNullOrWhiteSpace(venue?.City))
            yield return (PlaceQuery(venue.City, venue.Region, venue.Country), LocationSource.VenueCity);
        if (home?.HomeCity is { } homeCity && !string.IsNullOrWhiteSpace(homeCity.Name))
            yield return (PlaceQuery(homeCity.Name, homeCity.Region, homeCity.Country), LocationSource.HomeTeamCity);
    }

    /// <summary>The place-search query for a venue by name: "Name, City", or just the name when the city is missing.</summary>
    public static string VenueQuery(ProviderVenue venue) =>
        string.IsNullOrWhiteSpace(venue.City) ? venue.Name! : $"{venue.Name}, {venue.City}";

    /// <summary>"City, Region, Country", leaving out the parts that are missing.</summary>
    private static string PlaceQuery(params string?[] parts) =>
        string.Join(", ", parts.Where(p => !string.IsNullOrWhiteSpace(p)).Select(p => p!.Trim()));

    /// <summary>
    /// Looks a query up through the place search, or answers from the checked-in lookups, or from the
    /// saved lookups if it has been asked before. Every answer, misses too, is
    /// saved; failures are not.
    /// </summary>
    private async Task<Coordinates?> LookUpAsync(string query, CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        if (TryKnown(query, out var known))
            return known;

        // Only unknown searches and saves wait; recheck after waiting to avoid duplicate queries.
        await _gate.WaitAsync(cancellationToken);
        try
        {
            if (TryKnown(query, out known))
                return known;

            Coordinates? found;
            try
            {
                found = await _places.SearchAsync(query, cancellationToken);
            }
            catch (Exception ex) when (!cancellationToken.IsCancellationRequested)
            {
                // A failed lookup is not an answer: don't save it, try again next time.
                _logger.LogWarning(ex, "Place search failed for {Query}", query);
                return null;
            }

            lock (_knownLock)
                _saved![query] = found;
            await SaveAsync(_saved!, cancellationToken);
            return found;
        }
        finally
        {
            _gate.Release();
        }
    }

    private bool TryKnown(string query, out Coordinates? found)
    {
        // This lock protects local data only: no search or save can hold up a cache hit.
        lock (_knownLock)
        {
            _scenarioLocations ??= ReadCheckedIn<Dictionary<string, Coordinates>>(_scenarioLocationsPath) ?? [];
            if (_scenarioLocations.TryGetValue(query, out var checkedIn))
            {
                found = checkedIn;
                return true;
            }
            _leagueLocations ??= ReadCheckedIn<Dictionary<string, Coordinates?>>(_leagueLocationsPath) ?? [];
            if (_leagueLocations.TryGetValue(query, out found))
                return true;
            _saved ??= VenueCache.Read<Dictionary<string, Coordinates?>>(_savedLocationsPath, Json, _logger) ?? [];
            return _saved.TryGetValue(query, out found);
        }
    }

    private static T? ReadCheckedIn<T>(string path)
    {
        if (!File.Exists(path))
            return default;
        using var file = File.OpenRead(path);
        return JsonSerializer.Deserialize<T>(file, Json);
    }

    private Task SaveAsync(Dictionary<string, Coordinates?> saved, CancellationToken cancellationToken) =>
        VenueCache.SaveAsync(_savedLocationsPath, saved, Json, _logger, cancellationToken);
}
