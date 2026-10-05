namespace ScoreMap.Server.Games;

/// <summary>
/// A game as ScoreMap sends it to browsers. Serialized camelCase over SignalR;
/// mirrored by <c>web/src/games/game.ts</c>.
/// </summary>
public sealed record Game(
    string Id,
    string League,
    string Sport,
    DateTimeOffset StartTime,
    GameStatus Status,
    bool Delayed,
    DateTimeOffset? EndTime,
    GameTeam Home,
    GameTeam Away,
    string? Clock,
    int? Period,
    GameVenue Venue,
    IReadOnlyList<GameBroadcaster> Broadcasters,
    IReadOnlyList<StreamLink> StreamLinks);

public sealed record GameTeam(string Abbreviation, string FullName, string? LogoUrl, int? Score);

/// <summary>
/// Where a game is played. <see cref="TimeZone"/> is the venue's IANA time zone (e.g. "America/Chicago"),
/// or null when the venue could not be placed.
/// </summary>
public sealed record GameVenue(string? Name, string? City, string? Country, double Latitude, double Longitude, string? TimeZone);

/// <summary>
/// A channel or streaming service showing a game, the country it broadcasts to when known,
/// and its official watch link when the owner has listed one.
/// </summary>
public sealed record GameBroadcaster(string Name, string? Country, string? WatchUrl);

/// <summary>
/// An unofficial stream for a game, found by the stream finder on one of the owner's
/// configured sites (ADR-0002: hobby v1 only).
/// </summary>
public sealed record StreamLink(string Site, string Url);
