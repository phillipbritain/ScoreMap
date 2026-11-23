namespace ScoreMap.Server.GameFeed;

public static class NascarCarNumber
{
    /// <summary>Validates a Cup Series car number and preserves its leading zeros.</summary>
    public static string? Parse(string? number) =>
        number?.Trim() is { Length: > 0 and <= 3 } car && car.All(char.IsAsciiDigit) ? car : null;
}
