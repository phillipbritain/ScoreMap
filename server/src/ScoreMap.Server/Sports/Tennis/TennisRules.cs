using ScoreMap.Server.GameFeed;
using ScoreMap.Server.Games;

namespace ScoreMap.Server.Sports;

using ScoreMap.Server.Sports.Shared;

internal sealed class TennisRules : SportRule
{
    internal static readonly TennisRules Instance = new();
    internal override string Name => "Tennis";
    internal override SportUsual Usual => new(3, null);

    protected override string? ClockInPlay(ProviderGame game, League league, int period) =>
        Sets(game, period);

    protected override bool HotSides(ProviderGame game, ProviderSides sides, int period, League league) =>
        false;

    private static string Sets(ProviderGame game, int set)
    {
        if (game.Status == ProviderStatus.Final)
            return game.EarlyEnding?.Reason switch
            {
                EarlyEndingReason.Retired => "Ret.",
                EarlyEndingReason.Walkover => "W/O",
                _ => "Final",
            };
        return game.Sets.ElementAtOrDefault(set - 1) is { } games
            ? $"{ClockFormat.Ordinal(set)} set · {games.Home}–{games.Away}"
            : $"{ClockFormat.Ordinal(set)} set";
    }

    internal override GameScoreline? Scoreline(ProviderGame game)
    {
        if (game.Contest is not ProviderSides sides
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

    private static GameSet Set(ProviderSet set, int number, ProviderSides sides)
    {
        var (winner, first, second, loserTiebreak) = set.HomeWon switch
        {
            true => (sides.Home.Abbreviation, set.Home, set.Away, set.AwayTiebreak),
            false => (sides.Away.Abbreviation, set.Away, set.Home, set.HomeTiebreak),
            null => ((string?)null, set.Home, set.Away, (int?)null),
        };
        var score = loserTiebreak is { } points ? $"{first}-{second}({points})" : $"{first}-{second}";
        return new GameSet(ClockFormat.Ordinal(number), score, winner);
    }
}
