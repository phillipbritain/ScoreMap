using System.Text.Json;
using ScoreMap.Server.GameFeed;

namespace ScoreMap.Server.Venues;

/// <summary>
/// The owner's corrections file: a JSON object mapping venue names (case-insensitive) to
/// <c>{ "latitude": ..., "longitude": ... }</c>. Re-read whenever the file changes, so edits
/// take effect without a restart. A missing or unreadable file means no corrections.
/// </summary>
internal sealed class VenueCorrections(string path, ILogger logger)
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web)
    {
        ReadCommentHandling = JsonCommentHandling.Skip,
        AllowTrailingCommas = true,
    };

    private readonly Lock _lock = new();
    private DateTime? _loadedVersion;
    private Dictionary<string, Coordinates> _corrections = new(StringComparer.OrdinalIgnoreCase);

    public Coordinates? Find(string? venueName)
    {
        if (string.IsNullOrWhiteSpace(venueName))
            return null;
        lock (_lock)
        {
            Refresh();
            return _corrections.GetValueOrDefault(venueName.Trim());
        }
    }

    private void Refresh()
    {
        var version = File.Exists(path) ? File.GetLastWriteTimeUtc(path) : (DateTime?)null;
        if (version == _loadedVersion)
            return;
        _loadedVersion = version;
        _corrections = new(StringComparer.OrdinalIgnoreCase);
        if (version is null)
            return;
        try
        {
            var read = JsonSerializer.Deserialize<Dictionary<string, Coordinates>>(File.ReadAllText(path), Json);
            foreach (var (name, location) in read ?? [])
                _corrections[name.Trim()] = location;
        }
        catch (Exception ex) when (ex is IOException or JsonException)
        {
            logger.LogWarning(ex, "Couldn't read venue corrections from {Path}; ignoring them", path);
        }
    }
}
