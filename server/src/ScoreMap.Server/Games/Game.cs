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
    GameVenue Venue);

public sealed record GameTeam(string Abbreviation, string FullName, string? LogoUrl, int? Score);

public sealed record GameVenue(string? Name, string? City, string? Country, double Latitude, double Longitude);
