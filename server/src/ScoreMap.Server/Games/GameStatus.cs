using System.Text.Json.Serialization;

namespace ScoreMap.Server.Games;

/// <summary>A game's status in ScoreMap's terms (see GLOSSARY.md). Sent to browsers by name.</summary>
[JsonConverter(typeof(JsonStringEnumConverter<GameStatus>))]
public enum GameStatus
{
    Upcoming,
    Live,
    Final,
    /// <summary>
    /// Only a fight card's bout, when called off (postponed, suspended or canceled). A game is never
    /// sent Disrupted: a game that is isn't shown at all (ADR-0021).
    /// </summary>
    Disrupted,
}
