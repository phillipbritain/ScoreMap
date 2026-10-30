using ScoreMap.Server.GameFeed;

namespace ScoreMap.Server.Games;

/// <summary>
/// A tennis match's score set by set, the away side's games first as it's shown first, with the
/// loser's tiebreak points after a tiebreak set: "7-6(5) 4-3". A match ended early says so and names
/// the side that advanced: "7-5 ret. · N. Leme Da Silva advances", "W/O · C. Liu advances".
/// </summary>
public static class Scoreline
{
    /// <summary>The match's scoreline; null in other sports, and before a tennis match has any.</summary>
    public static string? For(ProviderGame game, League league)
    {
        if (league.Sport != Sport.Tennis)
            return null;
        var sets = string.Join(" ", game.Sets.Select(Set));
        var line = game.EarlyEnding?.Reason switch
        {
            EarlyEndingReason.Walkover => "W/O",
            EarlyEndingReason.Retired => $"{sets} ret.".Trim(),
            _ => sets,
        };
        if (game.EarlyEnding is { } ending)
            line = $"{line} · {ending.Winner} advances";
        return line.Length > 0 ? line : null;
    }

    private static string Set(ProviderSet set)
    {
        var games = $"{set.Away}-{set.Home}";
        // A tiebreak set's loser's points; none while its tiebreak is still being played.
        var lost = set.Home > set.Away ? set.AwayTiebreak : set.Away > set.Home ? set.HomeTiebreak : null;
        return lost is { } points ? $"{games}({points})" : games;
    }
}
