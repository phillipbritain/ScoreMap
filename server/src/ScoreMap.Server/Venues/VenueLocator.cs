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
/// Queries in the checked-in scenario venue lookups (ADR-0009) are answered from those, before the
/// saved lookups, and never reach the place search.
/// </summary>
public sealed class VenueLocator
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web) { WriteIndented = true };

    private readonly IPlaceSearch _places;
    private readonly ILogger<VenueLocator> _logger;
    private readonly string _savedLocationsPath;
    private readonly VenueCorrections _corrections;
    private readonly string _scenarioLocationsPath;
    private readonly SemaphoreSlim _gate = new(1, 1);
    private Dictionary<string, Coordinates?>? _saved;
    private Dictionary<string, Coordinates>? _scenarioLocations;

    public VenueLocator(IPlaceSearch places, IOptions<VenueOptions> options, IHostEnvironment environment,
        ILogger<VenueLocator> logger)
    {
        _places = places;
        _logger = logger;
        _savedLocationsPath = Path.Combine(environment.ContentRootPath, options.Value.SavedLocationsPath);
        _scenarioLocationsPath = Path.Combine(environment.ContentRootPath, options.Value.ScenarioLocationsPath);
        _corrections = new VenueCorrections(Path.Combine(environment.ContentRootPath, options.Value.CorrectionsPath), logger);
    }

    /// <summary>
    /// Where a game's pin goes, trying in order: the corrections file, the venue looked up by name
    /// and city (ESPN supplies no coordinates, ADR-0001), the venue's city centre, and the home team's city.
    /// Always answers; when every step fails the position is 0,0 and <see cref="VenueLocation.FoundBy"/>
    /// says so.
    /// </summary>
    public async Task<VenueLocation> LocateAsync(ProviderVenue? venue, ProviderTeam home, CancellationToken cancellationToken)
    {
        if (_corrections.Find(venue?.Name) is { } corrected)
            return new(corrected, LocationSource.Correction);

        if (!string.IsNullOrWhiteSpace(venue?.Name))
        {
            if (await LookUpAsync(VenueQuery(venue), cancellationToken) is { } found)
                return new(found, LocationSource.Venue);
        }

        if (!string.IsNullOrWhiteSpace(venue?.City)
            && await LookUpAsync(PlaceQuery(venue.City, venue.Region, venue.Country), cancellationToken) is { } city)
            return new(city, LocationSource.VenueCity);

        if (home.HomeCity is { } homeCity && !string.IsNullOrWhiteSpace(homeCity.Name)
            && await LookUpAsync(PlaceQuery(homeCity.Name, homeCity.Region, homeCity.Country), cancellationToken) is { } homeTown)
            return new(homeTown, LocationSource.HomeTeamCity);

        _logger.LogWarning("No position found for venue {Venue} or home team {Team}; pinning at 0,0",
            venue?.Name, home.FullName);
        return new(new Coordinates(0, 0), LocationSource.Nowhere);
    }

    /// <summary>The place-search query for a venue by name: "Name, City", or just the name when the city is missing.</summary>
    public static string VenueQuery(ProviderVenue venue) =>
        string.IsNullOrWhiteSpace(venue.City) ? venue.Name! : $"{venue.Name}, {venue.City}";

    /// <summary>"City, Region, Country", leaving out the parts that are missing.</summary>
    private static string PlaceQuery(params string?[] parts) =>
        string.Join(", ", parts.Where(p => !string.IsNullOrWhiteSpace(p)).Select(p => p!.Trim()));

    /// <summary>
    /// Looks a query up through the place search, or answers from the checked-in scenario venue
    /// lookups, or from the saved lookups if it has been asked before. Every answer, misses too, is
    /// saved; failures are not.
    /// </summary>
    private async Task<Coordinates?> LookUpAsync(string query, CancellationToken cancellationToken)
    {
        // One lookup at a time, so concurrent snapshots never repeat a query.
        await _gate.WaitAsync(cancellationToken);
        try
        {
            _scenarioLocations ??= await LoadScenarioLocationsAsync(cancellationToken);
            if (_scenarioLocations.TryGetValue(query, out var checkedIn))
                return checkedIn;

            _saved ??= await LoadAsync(cancellationToken);
            if (_saved.TryGetValue(query, out var saved))
                return saved;

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

            _saved[query] = found;
            await SaveAsync(_saved, cancellationToken);
            return found;
        }
        finally
        {
            _gate.Release();
        }
    }

    private async Task<Dictionary<string, Coordinates?>> LoadAsync(CancellationToken cancellationToken)
    {
        if (!File.Exists(_savedLocationsPath))
            return new Dictionary<string, Coordinates?>();
        await using var file = File.OpenRead(_savedLocationsPath);
        return await JsonSerializer.DeserializeAsync<Dictionary<string, Coordinates?>>(file, Json, cancellationToken)
            ?? new Dictionary<string, Coordinates?>();
    }

    private async Task<Dictionary<string, Coordinates>> LoadScenarioLocationsAsync(CancellationToken cancellationToken)
    {
        if (!File.Exists(_scenarioLocationsPath))
            return new Dictionary<string, Coordinates>();
        await using var file = File.OpenRead(_scenarioLocationsPath);
        return await JsonSerializer.DeserializeAsync<Dictionary<string, Coordinates>>(file, Json, cancellationToken)
            ?? new Dictionary<string, Coordinates>();
    }

    private async Task SaveAsync(Dictionary<string, Coordinates?> saved, CancellationToken cancellationToken)
    {
        Directory.CreateDirectory(Path.GetDirectoryName(_savedLocationsPath)!);
        var temp = _savedLocationsPath + ".tmp";
        await using (var file = File.Create(temp))
            await JsonSerializer.SerializeAsync(file, saved, Json, cancellationToken);
        File.Move(temp, _savedLocationsPath, overwrite: true);
    }
}
