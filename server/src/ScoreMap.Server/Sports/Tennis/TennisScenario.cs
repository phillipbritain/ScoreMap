using ScoreMap.Server.GameFeed;
using ScoreMap.Server.Games;
using ScoreMap.Server.Scenarios;
using ScoreMap.Server.Sports.Shared;
using static ScoreMap.Server.Sports.Shared.ScenarioFabrication;

namespace ScoreMap.Server.Sports;

/// <summary>
/// Tennis in a scenario looks as it does live: play moves a match on set by set itself
/// (<see cref="TennisMatchPlay"/>), so its progress line and scoreline come from its sets; a player has
/// no record, a match no odds, crowd or last score (nobody's play scores a game or set), and its note
/// is a round of the draw in tennis's shorthand.
/// </summary>
internal sealed class TennisScenario(League league) : SportScenario(league)
{
    internal override SidesPlay CreatePlay() => new TennisMatchPlay(League);

    /// <summary>Explicit sets are the score; shorthand alone stays as written outside play.</summary>
    internal static ProviderGame Written(ProviderGame game)
    {
        if (game.Sets.Count == 0)
            return game.EarlyEnding is null ? game : game with { Period = game.Period ?? 1 };
        var sides = game.Sides();
        return game with
        {
            Contest = new ProviderSides(
                sides.Home with { Score = game.Sets.Count(set => set.HomeWon == true) },
                sides.Away with { Score = game.Sets.Count(set => set.HomeWon == false) }),
            Period = game.Sets.Count,
            DisplayClock = null,
        };
    }

    internal override ProviderTeam WithRecord(ProviderTeam team) => team;
    protected override string NoteText(Random random) => Pick(random, "R1", "R2", "R3", "R16", "QF", "SF", "Final");
    internal override bool HasPlayDetails => false;
}
