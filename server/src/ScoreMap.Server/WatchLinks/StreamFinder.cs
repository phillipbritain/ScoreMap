using System.Globalization;
using System.Net;
using System.Text;
using System.Text.RegularExpressions;
using Microsoft.Extensions.Options;
using ScoreMap.Server.Games;

namespace ScoreMap.Server.WatchLinks;

/// <summary>
/// The unofficial stream finder (ADR-0002): searches the owner's configured stream sites for
/// a link to each Upcoming or Live game. Searches run in the background, so asking for a
/// game's links never waits on a site: it returns what the last search found (none at first)
/// and the game picks up new links on a later poll. Each site has a short timeout, results
/// (including none) are cached per game, and any failure just means no links from that site.
/// <para>
/// Hobby v1 only. To switch it off, leave <c>StreamFinder:Sites</c> empty (the default).
/// To remove it before a public launch, delete this file and <see cref="StreamFinderOptions"/>,
/// their registration in Program.cs, <see cref="Game.StreamLinks"/> (with its use in
/// <c>GameBoard</c> and <c>GameChanges</c>) and the browser's unofficial links section.
/// </para>
/// </summary>
public sealed class StreamFinder(
    IHttpClientFactory httpClients,
    IOptions<StreamFinderOptions> options,
    TimeProvider clock,
    IHostApplicationLifetime lifetime,
    ILogger<StreamFinder> logger)
{
    public const string HttpClientName = nameof(StreamFinder);

    /// <summary>At most this many links are shown for a game.</summary>
    public const int MaxLinks = 3;

    private static readonly TimeSpan MatchTimeout = TimeSpan.FromSeconds(1);

    private readonly Lock _lock = new();
    private readonly Dictionary<string, Search> _searches = new();

    /// <summary>
    /// The stream links found so far for the game, without waiting. Starts a background search
    /// when the game has none cached or its cached result has expired.
    /// </summary>
    public IReadOnlyList<StreamLink> LinksFor(Game game)
    {
        var settings = options.Value;
        if (settings.Sites.Count == 0 || game.Status == GameStatus.Final)
            return [];

        lock (_lock)
        {
            var now = clock.GetUtcNow();
            ForgetOldSearches(now);
            if (!_searches.TryGetValue(game.Id, out var search))
                _searches[game.Id] = search = new Search();
            if (search.Running is null && now >= search.Expires)
                search.Running = Task.Run(() => RunAsync(game, search, settings));
            return search.Links;
        }
    }

    /// <summary>Completes when every search started so far has finished. For tests.</summary>
    public Task SearchesFinishedAsync()
    {
        lock (_lock)
            return Task.WhenAll(_searches.Values.Select(s => s.Running).OfType<Task>());
    }

    private async Task RunAsync(Game game, Search search, StreamFinderOptions settings)
    {
        IReadOnlyList<StreamLink> links = [];
        try
        {
            var perSite = await Task.WhenAll(settings.Sites.Select(site => SearchSiteAsync(site, game, settings)));
            links = perSite.SelectMany(l => l).DistinctBy(l => l.Url).Take(MaxLinks).ToList();
        }
        finally
        {
            lock (_lock)
            {
                search.Links = links;
                search.Expires = clock.GetUtcNow() + TimeSpan.FromMinutes(settings.CacheMinutes);
                search.Running = null;
            }
        }
    }

    private async Task<IReadOnlyList<StreamLink>> SearchSiteAsync(StreamSite site, Game game, StreamFinderOptions settings)
    {
        try
        {
            using var timeout = CancellationTokenSource.CreateLinkedTokenSource(lifetime.ApplicationStopping);
            timeout.CancelAfter(TimeSpan.FromSeconds(settings.TimeoutSeconds));
            var searchUrl = new Uri(site.SearchUrl
                .Replace("{query}", Uri.EscapeDataString($"{game.Away.FullName} {game.Home.FullName}"))
                .Replace("{away}", Uri.EscapeDataString(game.Away.FullName))
                .Replace("{home}", Uri.EscapeDataString(game.Home.FullName)));

            using var response = await httpClients.CreateClient(HttpClientName).GetAsync(searchUrl, timeout.Token);
            response.EnsureSuccessStatusCode();
            var page = await response.Content.ReadAsStringAsync(timeout.Token);
            return LinksIn(page, searchUrl, site, game);
        }
        catch (Exception e)
        {
            logger.LogWarning(e, "Stream site {Site} gave no links for game {GameId}", site.Name, game.Id);
            return [];
        }
    }

    private static IReadOnlyList<StreamLink> LinksIn(string page, Uri pageUrl, StreamSite site, Game game)
    {
        var links = new List<StreamLink>();
        foreach (Match match in Regex.Matches(page, site.LinkPattern, RegexOptions.IgnoreCase, MatchTimeout))
        {
            var href = match.Groups["href"];
            if (!href.Success)
                continue;
            var text = match.Groups["text"] is { Success: true } label ? label.Value : "";
            var said = Words($"{WebUtility.HtmlDecode(text)} {href.Value}");
            if (!Mentions(said, game.Home) || !Mentions(said, game.Away))
                continue;
            if (Uri.TryCreate(pageUrl, WebUtility.HtmlDecode(href.Value), out var url) && url.Scheme is "http" or "https")
                links.Add(new StreamLink(site.Name, url.AbsoluteUri));
        }
        return links;
    }

    /// <summary>Whether the words mention the team by its nickname, the last word of its name ("Chiefs").</summary>
    private static bool Mentions(string words, GameTeam team) =>
        Words(team.FullName).Split(' ', StringSplitOptions.RemoveEmptyEntries).LastOrDefault() is { } nickname
        && words.Contains($" {nickname} ", StringComparison.Ordinal);

    /// <summary>Lowercase words without accents or punctuation, space-separated with a space at each end.</summary>
    private static string Words(string text)
    {
        var words = new StringBuilder(" ");
        foreach (var c in text.Normalize(NormalizationForm.FormD))
        {
            if (CharUnicodeInfo.GetUnicodeCategory(c) == UnicodeCategory.NonSpacingMark)
                continue;
            words.Append(char.IsLetterOrDigit(c) ? char.ToLowerInvariant(c) : ' ');
        }
        return words.Append(' ').ToString();
    }

    /// <summary>Drops results kept long past their expiry, so games long gone don't pile up.</summary>
    private void ForgetOldSearches(DateTimeOffset now)
    {
        foreach (var (id, search) in _searches.ToList())
            if (search.Running is null && now - search.Expires > TimeSpan.FromHours(1))
                _searches.Remove(id);
    }

    private sealed class Search
    {
        public IReadOnlyList<StreamLink> Links { get; set; } = [];
        public DateTimeOffset Expires { get; set; } = DateTimeOffset.MinValue;
        public Task? Running { get; set; }
    }
}
