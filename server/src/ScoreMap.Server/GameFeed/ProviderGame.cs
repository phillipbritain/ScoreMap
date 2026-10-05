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

public sealed record ProviderTeam(string Abbreviation, string FullName, string? LogoUrl, int? Score);

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
