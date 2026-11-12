using System.Globalization;
using System.Net;
using System.Text;
using System.Text.RegularExpressions;
using ScoreMap.Server.Games;

namespace ScoreMap.Server.WatchLinks;

/// <summary>Parses configured schedule anchors once, then matches only unambiguous listings.</summary>
internal static class StreamFinderSchedule
{
    private static readonly TimeSpan RegexTimeout = TimeSpan.FromSeconds(1);
    private static readonly TimeSpan StartTolerance = TimeSpan.FromMinutes(30);

    internal sealed record Listing(string Url, string? League, string First, string Second, DateTimeOffset? Start);

    internal static IReadOnlyList<Listing> Read(string page, Uri pageUrl, StreamSite site)
    {
        var listings = new List<Listing>();
        foreach (Match match in Regex.Matches(page, site.LinkPattern, RegexOptions.IgnoreCase, RegexTimeout))
        {
            if (!match.Groups["href"].Success
                || !Uri.TryCreate(pageUrl, WebUtility.HtmlDecode(match.Groups["href"].Value), out var url)
                || url.Scheme is not ("http" or "https")
                || url.Authority != pageUrl.Authority || url.UserInfo.Length != 0)
                continue;

            var first = match.Groups["first"].Value;
            var second = match.Groups["second"].Value;
            if (!match.Groups["first"].Success || !match.Groups["second"].Success)
            {
                // Simple configured sites can supply a plain "Team A vs Team B" anchor label.
                var pair = Regex.Split(PlainText(match.Groups["text"].Value), @"\s+(?:vs\.?|v\.?|@)\s+",
                    RegexOptions.IgnoreCase, RegexTimeout);
                if (pair.Length != 2)
                    continue;
                (first, second) = (pair[0], pair[1]);
            }
            var start = match.Groups["start"];
            DateTimeOffset? startsAt = null;
            if (start.Success && start.Value.Length > 0)
            {
                // Only absolute timestamps with an explicit zone; never guess the page's time zone.
                var timestamp = WebUtility.HtmlDecode(start.Value).Trim();
                if (!Regex.IsMatch(timestamp, @"^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$",
                        RegexOptions.IgnoreCase, RegexTimeout)
                    || !DateTimeOffset.TryParse(timestamp, CultureInfo.InvariantCulture,
                        DateTimeStyles.None, out var parsed))
                    continue;
                startsAt = parsed;
            }
            var a = Normalize(PlainText(first));
            var b = Normalize(PlainText(second));
            if (a.Length == 0 || b.Length == 0 || a == b)
                continue;
            listings.Add(new Listing(url.AbsoluteUri,
                match.Groups["league"].Success ? Normalize(match.Groups["league"].Value) : null,
                a, b, startsAt));
        }
        return listings;
    }

    internal static StreamLink? LinkFor(IReadOnlyList<Listing> listings, StreamSite site, Game game, GameSides sides)
    {
        var home = Names(sides.Home.FullName, game.League, site);
        var away = Names(sides.Away.FullName, game.League, site);
        // Overlapping aliases cannot tell the two sides apart.
        if (home.Overlaps(away))
            return null;
        var matches = listings.Where(listing =>
                LeagueMatches(listing.League, game.League, site)
                && ((home.Contains(listing.First) && away.Contains(listing.Second))
                    || (home.Contains(listing.Second) && away.Contains(listing.First)))
                && (listing.Start is null || (listing.Start.Value - game.StartTime).Duration() <= StartTolerance))
            .Select(listing => listing.Url).Distinct().Take(2).ToList();
        return matches.Count == 1 ? new StreamLink(site.Name, matches[0]) : null;
    }

    private static bool LeagueMatches(string? listingLeague, string gameLeague, StreamSite site) =>
        site.LeagueAliases.Count == 0
            ? listingLeague is null || listingLeague == Normalize(gameLeague)
            : listingLeague is not null && site.LeagueAliases.Any(pair =>
                Normalize(pair.Key) == Normalize(gameLeague) && pair.Value.Any(alias => Normalize(alias) == listingLeague));

    private static HashSet<string> Names(string fullName, string league, StreamSite site)
    {
        var names = new HashSet<string>(StringComparer.Ordinal) { Normalize(fullName) };
        foreach (var (aliasLeague, teams) in site.TeamAliases)
            if (Normalize(aliasLeague) == Normalize(league))
                foreach (var (team, aliases) in teams)
                    if (Normalize(team) == Normalize(fullName))
                        names.UnionWith(aliases.Select(Normalize).Where(alias => alias.Length > 0));
        return names;
    }

    private static string PlainText(string html) => WebUtility.HtmlDecode(
        Regex.Replace(html, "<[^>]*>", " ", RegexOptions.None, RegexTimeout));

    private static string Normalize(string text)
    {
        var words = new StringBuilder();
        foreach (var c in text.Normalize(NormalizationForm.FormD))
        {
            if (CharUnicodeInfo.GetUnicodeCategory(c) == UnicodeCategory.NonSpacingMark)
                continue;
            if (char.IsLetterOrDigit(c))
                words.Append(char.ToLowerInvariant(c));
            else if (words.Length > 0 && words[^1] != ' ')
                words.Append(' ');
        }
        return words.ToString().Trim();
    }
}
