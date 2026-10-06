using System.Text.Json;
using Microsoft.Extensions.Options;

namespace ScoreMap.Server.WatchLinks;

/// <summary>
/// Official watch links: the owner's list connecting broadcaster names (as the game feed
/// provider spells them, matched ignoring case and surrounding spaces) to the official
/// service's watch URL. Adding a link is an edit to the file; it takes effect without a
/// restart. A missing or unreadable file means no links, so broadcasters show as plain names.
/// </summary>
public sealed class OfficialWatchLinks(IOptions<WatchLinkOptions> options, IHostEnvironment environment, ILogger<OfficialWatchLinks> logger)
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web)
    {
        ReadCommentHandling = JsonCommentHandling.Skip,
        AllowTrailingCommas = true,
    };

    private readonly string _path = System.IO.Path.Combine(environment.ContentRootPath, options.Value.Path);
    private readonly Lock _lock = new();
    private DateTime? _loadedVersion;
    private Dictionary<string, string> _urls = new(StringComparer.OrdinalIgnoreCase);

    /// <summary>The watch URL for a broadcaster, or null when it isn't in the list.</summary>
    public string? Find(string broadcasterName)
    {
        lock (_lock)
        {
            Refresh();
            return _urls.GetValueOrDefault(broadcasterName.Trim());
        }
    }

    private void Refresh()
    {
        var version = File.Exists(_path) ? File.GetLastWriteTimeUtc(_path) : (DateTime?)null;
        if (version == _loadedVersion)
            return;
        _loadedVersion = version;
        _urls = new(StringComparer.OrdinalIgnoreCase);
        if (version is null)
            return;
        try
        {
            var entries = JsonSerializer.Deserialize<List<Entry>>(File.ReadAllText(_path), Json);
            foreach (var entry in entries ?? [])
                if (!string.IsNullOrWhiteSpace(entry.Url))
                    foreach (var name in entry.Names ?? [])
                        _urls[name.Trim()] = entry.Url;
        }
        catch (Exception ex) when (ex is IOException or JsonException)
        {
            logger.LogWarning(ex, "Couldn't read watch links from {Path}; showing broadcasters without links", _path);
        }
    }

    private sealed record Entry(List<string>? Names, string? Url);
}
