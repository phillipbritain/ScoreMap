using ScoreMap.Server.GameFeed;
using ScoreMap.Server.Games;
using ScoreMap.Server.Scenarios;

namespace ScoreMap.Server.Venues;

/// <summary>
/// The other leagues' ESPN ids for a venue, from the venue list (ADR-0028), so the photo search can use
/// another league's photo of the venue when the game's own league has none: MLS's Soldier Field (ESPN's
/// 1452) has no photo, the NFL's (3933) does. ESPN gives each league its own id, and a live game's feed
/// gives only its own league's, so the list is where the others come from.
/// </summary>
public sealed class VenueLeagueCatalog
{
    private readonly Dictionary<string, List<Entry>> _byName = new(StringComparer.OrdinalIgnoreCase);

    /// <summary>A catalog with no venues: every venue's photo comes from its own league, or Commons.</summary>
    public static VenueLeagueCatalog Empty { get; } = new([], []);

    public VenueLeagueCatalog(IEnumerable<ScenarioVenue> venues, IEnumerable<League> leagues)
    {
        var keys = leagues.ToDictionary(league => league.Name, league => league.Key, StringComparer.OrdinalIgnoreCase);
        foreach (var venue in venues)
            _byName[venue.Name] = venue.Leagues
                .Where(league => league.Id is not null && keys.ContainsKey(league.League))
                .Select(league => new Entry(keys[league.League], league.Id!, league.City))
                .ToList();
    }

    /// <summary>
    /// The venue's ESPN ids in leagues other than <paramref name="leagueKey"/>'s, by league key: none when the
    /// list doesn't have it. A venue is the list's when its name is, and its city is one of the list's for it
    /// (the part before any comma, as MLS writes "Chicago, Illinois"), so another place of the same name isn't.
    /// </summary>
    public IReadOnlyList<(string LeagueKey, string Id)> OtherLeagues(string leagueKey, ProviderVenue venue)
    {
        if (venue.Name is null || !_byName.TryGetValue(venue.Name, out var entries)
            || !entries.Any(entry => SamePlace(entry.City, venue.City)))
            return [];
        var own = LeaguePath(leagueKey);
        return entries.Where(entry => LeaguePath(entry.LeagueKey) != own)
            .Select(entry => (entry.LeagueKey, entry.Id))
            .Distinct()
            .ToList();
    }

    private static bool SamePlace(string? listed, string? city) =>
        listed is not null && city is not null && string.Equals(Town(listed), Town(city), StringComparison.OrdinalIgnoreCase);

    private static string Town(string city) => city.Split(',')[0].Trim();

    // A league key may carry scoreboard options ("basketball/mens-college-basketball?groups=50").
    private static string LeaguePath(string leagueKey) => leagueKey.Split('?')[0];

    private sealed record Entry(string LeagueKey, string Id, string? City);
}
