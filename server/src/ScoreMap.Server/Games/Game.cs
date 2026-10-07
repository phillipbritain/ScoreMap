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
    Disruption? Disruption,
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
/// or null when the venue could not be placed. <see cref="Photo"/> is null until a photo of the venue
/// has been found, and stays null for a venue that has none.
/// </summary>
public sealed record GameVenue(string? Name, string? City, string? Country, double Latitude, double Longitude, string? TimeZone,
    VenuePhoto? Photo = null);

/// <summary>
/// A photo of a venue for the top of the game panel: from outside or of the playing area, whichever
/// its source gives. <see cref="Credit"/> is set when the photo's licence asks for attribution
/// (Wikimedia Commons photos); ESPN's photos have none.
/// </summary>
public sealed record VenuePhoto(string Url, PhotoCredit? Credit);

/// <summary>
/// Who took a photo and under what licence, shown under it. <see cref="SourceUrl"/> is the photo's
/// own page, where its full licence terms are.
/// </summary>
public sealed record PhotoCredit(string Author, string Licence, string? LicenceUrl, string SourceUrl);

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
