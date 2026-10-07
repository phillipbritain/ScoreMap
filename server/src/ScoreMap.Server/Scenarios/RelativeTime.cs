using System.Globalization;
using System.Text.RegularExpressions;

namespace ScoreMap.Server.Scenarios;

/// <summary>
/// A time relative to a scenario's start, as scenario files write it: hours, minutes and seconds,
/// largest first, optionally negative, e.g. <c>"-40m"</c>, <c>"2h"</c>, <c>"1h30m"</c>, <c>"90s"</c>, <c>"0"</c>.
/// </summary>
public static partial class RelativeTime
{
    public static bool TryParse(string? text, out TimeSpan time)
    {
        time = default;
        if (text is null)
            return false;
        var trimmed = text.Trim();
        if (trimmed == "0")
            return true;
        var match = Pattern().Match(trimmed);
        if (!match.Success || match.Groups["h"].Length + match.Groups["m"].Length + match.Groups["s"].Length == 0)
            return false;
        time = TimeSpan.FromHours(Number(match, "h")) + TimeSpan.FromMinutes(Number(match, "m")) + TimeSpan.FromSeconds(Number(match, "s"));
        if (match.Groups["sign"].Value == "-")
            time = -time;
        return true;
    }

    private static int Number(Match match, string group) =>
        match.Groups[group].Success ? int.Parse(match.Groups[group].Value, CultureInfo.InvariantCulture) : 0;

    [GeneratedRegex(@"^(?<sign>[+-])?(?:(?<h>\d+)h)?(?:(?<m>\d+)m)?(?:(?<s>\d+)s)?$")]
    private static partial Regex Pattern();
}
