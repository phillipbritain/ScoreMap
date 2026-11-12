namespace ScoreMap.Server.WatchLinks;

/// <summary>
/// Unofficial stream finder settings, under "StreamFinder" in appsettings.json (ADR-0002).
/// The site list is configured in appsettings.json; an empty list switches the finder off.
/// </summary>
public sealed class StreamFinderOptions
{
    /// <summary>The sites searched for each game, in the order their links are listed.</summary>
    public List<StreamSite> Sites { get; set; } = [];

    /// <summary>How long one site gets to answer a search before it is skipped.</summary>
    public double TimeoutSeconds { get; set; } = 3;

    /// <summary>How long a parsed page (including an empty or failed result) is kept before fetching again.</summary>
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
    /// for the link, <c>first</c> and <c>second</c> for side names (or <c>text</c> for a plain
    /// Team A vs Team B label), optionally <c>league</c> and <c>start</c> (ISO 8601 with zone).
    /// </summary>
    public string LinkPattern { get; set; } = "";

    /// <summary>ScoreMap league names mapped to the site's category names. Unmapped leagues are omitted.</summary>
    public Dictionary<string, string[]> LeagueAliases { get; set; } = [];

    /// <summary>Explicit alternate side names, keyed by ScoreMap league, then full team name.</summary>
    public Dictionary<string, Dictionary<string, string[]>> TeamAliases { get; set; } = [];
}
