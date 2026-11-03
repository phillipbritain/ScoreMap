using System.Text.Json.Serialization;

namespace ScoreMap.Server.GameFeed;

/// <summary>
/// A goal or card in soccer, or a score or card in rugby, as the game panel lists them. Rugby's penalty goal
/// (a penalty kicked between the posts) is a <see cref="PenaltyGoal"/>, as soccer's goal from a penalty kick is.
/// </summary>
[JsonConverter(typeof(JsonStringEnumConverter<KeyEventKind>))]
public enum KeyEventKind
{
    Goal,
    PenaltyGoal,
    OwnGoal,
    YellowCard,
    RedCard,

    /// <summary>Rugby: a try, or a penalty try.</summary>
    Try,

    /// <summary>Rugby: a conversion kicked after a try.</summary>
    Conversion,

    /// <summary>Rugby: a drop goal.</summary>
    DropGoal,
}
