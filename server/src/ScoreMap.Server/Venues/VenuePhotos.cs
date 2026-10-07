using System.Text.Json;
using Microsoft.Extensions.Options;
using ScoreMap.Server.GameFeed;
using ScoreMap.Server.Games;

namespace ScoreMap.Server.Venues;

/// <summary>
/// Each venue's photo for the game panel. Searches run in the background, one at a time, so
/// asking for a photo never waits: it returns the photo found so far (none at first) and the
/// game picks it up on a later poll. Every answer, no photo too, is saved to a file, so each
/// venue is searched for only once, ever. A failed search isn't saved; the venue is searched
/// for again after <see cref="RetryAfterFailure"/>.
/// </summary>
public sealed class VenuePhotos
{
    /// <summary>After a failed search, how long until the venue is searched for again.</summary>
    public static readonly TimeSpan RetryAfterFailure = TimeSpan.FromMinutes(30);

    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web) { WriteIndented = true };

    private readonly IVenuePhotoSearch _search;
    private readonly TimeProvider _clock;
    private readonly IHostApplicationLifetime _lifetime;
    private readonly ILogger<VenuePhotos> _logger;
    private readonly string _savedPhotosPath;

    private readonly Lock _lock = new();
    private readonly SemaphoreSlim _oneAtATime = new(1, 1);
    private readonly Dictionary<string, Task> _running = new();
    private readonly Dictionary<string, DateTimeOffset> _failedAt = new();
    private Dictionary<string, VenuePhoto?>? _saved;

    public VenuePhotos(IVenuePhotoSearch search, IOptions<VenueOptions> options, IHostEnvironment environment,
        TimeProvider clock, IHostApplicationLifetime lifetime, ILogger<VenuePhotos> logger)
    {
        _search = search;
        _clock = clock;
        _lifetime = lifetime;
        _logger = logger;
        _savedPhotosPath = Path.Combine(environment.ContentRootPath, options.Value.SavedPhotosPath);
    }

    /// <summary>
    /// The venue's photo if one has been found, without waiting. Starts a background search the
    /// first time a venue is asked about, and again once <see cref="RetryAfterFailure"/> has passed
    /// since a failed one.
    /// </summary>
    public VenuePhoto? PhotoFor(string leagueKey, ProviderVenue? venue)
    {
        if (string.IsNullOrWhiteSpace(venue?.Name))
            return null;
        var key = Key(venue);
        lock (_lock)
        {
            _saved ??= Load();
            if (_saved.TryGetValue(key, out var photo))
                return photo;
            if (_running.ContainsKey(key)
                || (_failedAt.TryGetValue(key, out var failedAt) && _clock.GetUtcNow() < failedAt + RetryAfterFailure))
                return null;
            _running[key] = Task.Run(() => SearchAsync(key, leagueKey, venue));
            return null;
        }
    }

    /// <summary>Completes when every search started so far has finished. For tests.</summary>
    public Task SearchesFinishedAsync()
    {
        lock (_lock)
            return Task.WhenAll(_running.Values);
    }

    /// <summary>"Name, City", the same way the venue locator asks for the venue.</summary>
    private static string Key(ProviderVenue venue) =>
        string.IsNullOrWhiteSpace(venue.City) ? venue.Name!.Trim() : $"{venue.Name!.Trim()}, {venue.City.Trim()}";

    private async Task SearchAsync(string key, string leagueKey, ProviderVenue venue)
    {
        var cancellationToken = _lifetime.ApplicationStopping;
        try
        {
            await _oneAtATime.WaitAsync(cancellationToken);
            try
            {
                var photo = await _search.SearchAsync(leagueKey, venue, cancellationToken);
                Dictionary<string, VenuePhoto?> toSave;
                lock (_lock)
                {
                    _saved![key] = photo;
                    _failedAt.Remove(key);
                    toSave = new(_saved);
                }
                await SaveAsync(toSave, cancellationToken);
            }
            finally
            {
                _oneAtATime.Release();
            }
        }
        catch (Exception e) when (!cancellationToken.IsCancellationRequested)
        {
            _logger.LogWarning(e, "Photo search failed for {Venue}; trying again in {Wait}", key, RetryAfterFailure);
            lock (_lock)
                _failedAt[key] = _clock.GetUtcNow();
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            // The server is stopping.
        }
        finally
        {
            lock (_lock)
                _running.Remove(key);
        }
    }

    private Dictionary<string, VenuePhoto?> Load()
    {
        if (!File.Exists(_savedPhotosPath))
            return new Dictionary<string, VenuePhoto?>();
        using var file = File.OpenRead(_savedPhotosPath);
        return JsonSerializer.Deserialize<Dictionary<string, VenuePhoto?>>(file, Json)
            ?? new Dictionary<string, VenuePhoto?>();
    }

    /// <summary>Saves through a temp file, so a crash mid-write never leaves a half-written file. Searches run one at a time, so saves do too.</summary>
    private async Task SaveAsync(Dictionary<string, VenuePhoto?> saved, CancellationToken cancellationToken)
    {
        Directory.CreateDirectory(Path.GetDirectoryName(_savedPhotosPath)!);
        var temp = _savedPhotosPath + ".tmp";
        await using (var file = File.Create(temp))
            await JsonSerializer.SerializeAsync(file, saved, Json, cancellationToken);
        File.Move(temp, _savedPhotosPath, overwrite: true);
    }
}
