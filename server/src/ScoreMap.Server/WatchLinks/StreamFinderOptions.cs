namespace ScoreMap.Server.WatchLinks;

/// <summary>
/// Unofficial stream finder settings, under "StreamFinder" in appsettings.json (ADR-0002).
/// The site list ships empty, which switches the finder off: the owner supplies the sites.
/// </summary>
public sealed class StreamFinderOptions
{
    /// <summary>The sites searched for each game, in the order their links are listed.</summary>
    public List<StreamSite> Sites { get; set; } = [];

    /// <summary>How long one site gets to answer a search before it is skipped.</summary>
    public double TimeoutSeconds { get; set; } = 3;

    /// <summary>How long a game's search result (links or none) is kept before searching again.</summary>
    public double CacheMinutes { get; set; } = 10;
}

/// <summary>One unofficial stream site, as the owner describes it.</summary>
public sealed class StreamSite
{
    /// <summary>The name the game panel shows with the site's links.</summary>
    public string Name { get; set; } = "";

    /// <summary>
    /// The site's search page. <c>{query}</c> is replaced by both teams' names
    /// ("Buffalo Bills Kansas City Chiefs"), <c>{away}</c> and <c>{home}</c> by one team's
    /// name each; all URL-escaped.
    /// </summary>
    public string SearchUrl { get; set; } = "";

    /// <summary>
    /// A regular expression finding links in the search page, with a named group <c>href</c>
    /// for the link and optionally <c>text</c> for its label. A link is kept only when its
    /// label or address mentions both teams.
    /// </summary>
    public string LinkPattern { get; set; } = "";
}
