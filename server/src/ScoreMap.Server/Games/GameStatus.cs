using System.Text.Json.Serialization;

namespace ScoreMap.Server.Games;

/// <summary>A game's status in ScoreMap's terms (see GLOSSARY.md). Sent to browsers by name.</summary>
[JsonConverter(typeof(JsonStringEnumConverter<GameStatus>))]
public enum GameStatus
{
    Upcoming,
    Live,
    Final,
    Disrupted,
}

/// <summary>Which kind of disruption made a game <see cref="GameStatus.Disrupted"/>. Sent to browsers by name.</summary>
[JsonConverter(typeof(JsonStringEnumConverter<Disruption>))]
public enum Disruption
{
    Postponed,
    Suspended,
    Canceled,
}
