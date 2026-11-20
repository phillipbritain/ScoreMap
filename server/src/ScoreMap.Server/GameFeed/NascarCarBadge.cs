namespace ScoreMap.Server.GameFeed;

/// <summary>
/// A NASCAR Cup car's number in its team's own lettering, as NASCAR's site shows it: an image on NASCAR's
/// unofficial image server, under the same terms as ESPN's feed (ADR-0001, ADR-0020), by the car's number.
/// </summary>
public static class NascarCarBadge
{
    /// <summary>The Cup Series' badges; NASCAR numbers its series, the Cup Series 1.</summary>
    private const string CupBadges = "https://cf.nascar.com/data/images/carbadges/1/";

    /// <summary>The badge for a car's number ("5", "24", "01"); null for no number, or one that isn't a car number.</summary>
    public static string? Url(string? number) =>
        number?.Trim() is { Length: > 0 and <= 3 } car && car.All(char.IsAsciiDigit) ? $"{CupBadges}{car}.png" : null;
}
