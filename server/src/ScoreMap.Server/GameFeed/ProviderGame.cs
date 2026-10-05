namespace ScoreMap.Server.GameFeed;

/// <summary>A game as a game feed provider reports it, in provider-neutral terms.</summary>
public sealed record ProviderGame(
    string Id,
    string LeagueKey,
    DateTimeOffset StartTime,
    ProviderTeam Home,
    ProviderTeam Away,
    ProviderStatus Status,
    string? DisplayClock,
    int? Period,
    ProviderVenue? Venue,
    IReadOnlyList<ProviderBroadcaster> Broadcasters);

/// <summary>
/// A team in a game. <see cref="HomeCity"/> is the city the team plays its home games in, when the
/// provider knows it; the venue locator falls back to it for a home team's game with no venue.
/// </summary>
public sealed record ProviderTeam(string Abbreviation, string FullName, string? LogoUrl, int? Score,
    ProviderCity? HomeCity = null);

/// <summary>A city as the provider names it, e.g. ("Charlotte", "NC", "USA").</summary>
public sealed record ProviderCity(string Name, string? Region, string? Country);

/// <summary>
/// The venue as the provider reports it. <see cref="Location"/> is set only when
/// the provider supplies coordinates (ESPN does not; the venue locator fills the gap).
/// </summary>
public sealed record ProviderVenue(string? Name, string? City, string? Region, string? Country, Coordinates? Location = null);

public sealed record Coordinates(double Latitude, double Longitude);

public sealed record ProviderBroadcaster(string Name, string? Country);

public enum ProviderStatus
{
    Scheduled,
    InProgress,
    Delayed,
    Final,
    Postponed,
    Suspended,
    Canceled,
}
