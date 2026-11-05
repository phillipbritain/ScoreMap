using System.Diagnostics;
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
    protected override FieldPlay Field => RacingFieldPlay.Instance;

    // Unused: play moves a written match on itself, and a made-up one would need players, which the team list has none of.
    internal override SportPlay CreatePlay() => new CountdownPlay(League, new(1.4, [(1, 1.0)], 6, null));

    internal override bool PlaysSidesItself => true;
    internal override ProviderGame TakeOn(ProviderGame game) => TennisMatchPlay.TakeOn(game);
    protected override (ProviderGame Game, double Through) PlaySides(ProviderGame game, double before, double through, Random random) =>
        TennisMatchPlay.Advance(game, League, before, through, random);

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
    internal override ProviderOdds? Odds(ProviderGame game) => null;
    internal override int? Attendance(ProviderGame game) => null;
    internal override bool HasPlayDetails => false;

    // None of these is asked for: there are no odds, crowd or last score.
    protected override (string Line, double Total) BettingLine(Random random, ProviderTeam favourite) => throw new UnreachableException();
    protected override int Capacity => throw new UnreachableException();
    protected override int UsualScore => throw new UnreachableException();
    protected override string ScoreText(int points, Random random) => throw new UnreachableException();
}
