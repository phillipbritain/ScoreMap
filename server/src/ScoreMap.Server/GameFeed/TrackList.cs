using System.Text.Json;

namespace ScoreMap.Server.GameFeed;

/// <summary>
/// The checked-in track list for a racing league whose feed gives no venue anywhere (IndyCar): a JSON object
/// mapping each race's name, as the feed gives it ("Grand Prix of Long Beach"), to its track's
/// <c>{ "name", "city", "region", "country", "latitude", "longitude" }</c>. Re-read whenever the file changes,
/// so edits take effect without a restart. A race missing from it has no track, and is logged by name once;
/// a missing or unreadable file means no tracks.
/// </summary>
public sealed class TrackList(string path, ILogger logger)
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web)
    {
        ReadCommentHandling = JsonCommentHandling.Skip,
        AllowTrailingCommas = true,
    };

    private readonly Lock _lock = new();
    private readonly HashSet<string> _missingLogged = new(StringComparer.OrdinalIgnoreCase);
    private DateTime? _loadedVersion;
    private Dictionary<string, ProviderVenue> _tracks = new(StringComparer.OrdinalIgnoreCase);

    /// <summary>The race's track, with its position; null for a race not in the list.</summary>
    public ProviderVenue? Find(string? raceName)
    {
        if (string.IsNullOrWhiteSpace(raceName))
            return null;
        lock (_lock)
        {
            Refresh();
            if (_tracks.TryGetValue(raceName.Trim(), out var track))
                return track;
            if (_missingLogged.Add(raceName.Trim()))
                logger.LogWarning("No track for the race {Race} in {Path}; it has no pin until one is added", raceName.Trim(), path);
            return null;
        }
    }

    private void Refresh()
    {
        var version = File.Exists(path) ? File.GetLastWriteTimeUtc(path) : (DateTime?)null;
        if (version == _loadedVersion)
            return;
        _loadedVersion = version;
        _tracks = new(StringComparer.OrdinalIgnoreCase);
        // A race added since is worth logging again if it's still missing.
        _missingLogged.Clear();
        if (version is null)
            return;
        try
        {
            var read = JsonSerializer.Deserialize<Dictionary<string, Track>>(File.ReadAllText(path), Json);
            foreach (var (race, track) in read ?? [])
                if (!string.IsNullOrWhiteSpace(track.Name))
                    _tracks[race.Trim()] = new ProviderVenue(track.Name.Trim(), track.City, track.Region, track.Country,
                        Location: new Coordinates(track.Latitude, track.Longitude));
        }
        catch (Exception ex) when (ex is IOException or JsonException)
        {
            logger.LogWarning(ex, "Couldn't read the track list from {Path}; no race has a track", path);
        }
    }

    private sealed record Track(string? Name, string? City, string? Region, string? Country, double Latitude, double Longitude);
}
