using System.Text.Json;
using System.Text.Json.Serialization;

namespace ScoreMap.Server.Games;

/// <summary>
/// A change to one game between two fetches, pushed to browsers over SignalR.
/// Carries the game's current state (its last state for <see cref="GameChangeKind.Removed"/>).
/// Mirrored by <c>web/src/games/gameChange.ts</c>.
/// </summary>
public sealed record GameChange(GameChangeKind Kind, Game Game);

/// <summary>
/// What happened to a game. Each game gets at most one change per fetch: the first
/// that applies of Started, Finished, ScoreChanged, then Updated.
/// </summary>
[JsonConverter(typeof(CamelCaseEnumConverter<GameChangeKind>))]
public enum GameChangeKind
{
    /// <summary>The game is new on the board (or has entered its pin window).</summary>
    Added,

    /// <summary>The game has left the board (or its pin window).</summary>
    Removed,

    /// <summary>Either team's score changed.</summary>
    ScoreChanged,

    /// <summary>The game went from Upcoming to Live.</summary>
    Started,

    /// <summary>The game became Final.</summary>
    Finished,

    /// <summary>Anything else changed, such as the clock or period. Not animated.</summary>
    Updated,
}

/// <summary>Serializes an enum as its camelCase name, e.g. <c>"scoreChanged"</c>.</summary>
public sealed class CamelCaseEnumConverter<TEnum>() : JsonStringEnumConverter<TEnum>(JsonNamingPolicy.CamelCase)
    where TEnum : struct, Enum;
