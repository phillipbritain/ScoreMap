using System.Text.Json.Serialization;

namespace ScoreMap.Server.GameFeed;

/// <summary>A goal or card in soccer, as the game panel lists them.</summary>
[JsonConverter(typeof(JsonStringEnumConverter<KeyEventKind>))]
public enum KeyEventKind
{
    Goal,
    PenaltyGoal,
    OwnGoal,
    YellowCard,
    RedCard,
}
