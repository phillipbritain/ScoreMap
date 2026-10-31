using ScoreMap.Server.GameFeed;

namespace ScoreMap.Server.Games;

/// <summary>A tennis match's score set by set (see <see cref="GameScoreline"/>).</summary>
public static class Scoreline
{
    /// <summary>The match's scoreline; null in other sports, and before a tennis match has any.</summary>
    public static GameScoreline? For(ProviderGame game, League league)
    {
        if (league.Sport != Sport.Tennis || game.Contest is not ProviderSides sides
            || (game.Sets.Count == 0 && game.EarlyEnding is null))
            return null;
        var ending = game.EarlyEnding?.Reason switch
        {
            EarlyEndingReason.Retired => "ret.",
            EarlyEndingReason.Walkover => "W/O",
            _ => null,
        };
        var sets = game.Sets.Select((set, i) => Set(set, i + 1, sides)).ToList();
        return new GameScoreline(sets, ending, game.EarlyEnding?.Winner);
    }

    /// <summary>A set: the winner's games first once it's won, the home side's while it's played.</summary>
    private static GameSet Set(ProviderSet set, int number, ProviderSides sides)
    {
        var (winner, first, second, loserTiebreak) = set.HomeWon switch
        {
            true => (sides.Home.Abbreviation, set.Home, set.Away, set.AwayTiebreak),
            false => (sides.Away.Abbreviation, set.Away, set.Home, set.HomeTiebreak),
            null => ((string?)null, set.Home, set.Away, (int?)null),
        };
        var score = loserTiebreak is { } points ? $"{first}-{second}({points})" : $"{first}-{second}";
        return new GameSet(ClockLine.Ordinal(number), score, winner);
    }
}
