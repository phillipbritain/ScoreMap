namespace ScoreMap.Server.WatchLinks;

/// <summary>Watch link settings, under "WatchLinks" in appsettings.json.</summary>
public sealed class WatchLinkOptions
{
    /// <summary>
    /// The owner's official watch links file, relative to the content root: a list of
    /// <c>{ "names": [...], "url": "..." }</c> entries connecting broadcaster names to the
    /// service's watch page. Re-read whenever it changes.
    /// </summary>
    public string Path { get; set; } = "watch-links.json";
}
