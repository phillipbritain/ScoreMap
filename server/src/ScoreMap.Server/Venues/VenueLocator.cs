using System.Text.Json;
using Microsoft.Extensions.Options;
using ScoreMap.Server.GameFeed;

namespace ScoreMap.Server.Venues;

/// <summary>
/// Resolves where a game's pin goes. Looks each venue up once by name and city
/// through the place search and saves the answer (misses too) to a file, so
/// later runs never repeat a lookup.
/// </summary>
public sealed class VenueLocator
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web) { WriteIndented = true };

    private readonly IPlaceSearch _places;
    private readonly ILogger<VenueLocator> _logger;
    private readonly string _savedLocationsPath;
    private readonly SemaphoreSlim _gate = new(1, 1);
    private Dictionary<string, Coordinates?>? _saved;

    public VenueLocator(IPlaceSearch places, IOptions<VenueOptions> options, IHostEnvironment environment,
        ILogger<VenueLocator> logger)
    {
        _places = places;
        _logger = logger;
        _savedLocationsPath = Path.Combine(environment.ContentRootPath, options.Value.SavedLocationsPath);
    }

    /// <summary>The venue's position, or null when it can't be found.</summary>
    public async Task<Coordinates?> LocateAsync(ProviderVenue venue, CancellationToken cancellationToken)
    {
        if (venue.Location is not null)
            return venue.Location;
        if (string.IsNullOrWhiteSpace(venue.Name))
            return null;

        var query = string.IsNullOrWhiteSpace(venue.City) ? venue.Name : $"{venue.Name}, {venue.City}";

        // One lookup at a time, so concurrent snapshots never repeat a query.
        await _gate.WaitAsync(cancellationToken);
        try
        {
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
                _logger.LogWarning(ex, "Place search failed for venue {Query}", query);
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

    private async Task SaveAsync(Dictionary<string, Coordinates?> saved, CancellationToken cancellationToken)
    {
        Directory.CreateDirectory(Path.GetDirectoryName(_savedLocationsPath)!);
        var temp = _savedLocationsPath + ".tmp";
        await using (var file = File.Create(temp))
            await JsonSerializer.SerializeAsync(file, saved, Json, cancellationToken);
        File.Move(temp, _savedLocationsPath, overwrite: true);
    }
}
