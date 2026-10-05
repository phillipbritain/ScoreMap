using System.Text.Json.Serialization;

namespace ScoreMap.Server.Games;

/// <summary>A game's status in ScoreMap's terms (see GLOSSARY.md). Sent to browsers by name.</summary>
[JsonConverter(typeof(JsonStringEnumConverter<GameStatus>))]
public enum GameStatus
{
    Upcoming,
    Live,
    Final,
}
