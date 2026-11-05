using ScoreMap.Server.GameFeed;
using ScoreMap.Server.Games;
using ScoreMap.Server.Scenarios;
using ScoreMap.Server.Sports.Shared;
using static ScoreMap.Server.Sports.Shared.ScenarioFabrication;

namespace ScoreMap.Server.Sports;

/// <summary>
/// A tennis match under scenario play, game by game, as the feed reports a live one: its score is the
/// sets each player has won, its period the set being played, and its sets the games in each; it has
/// no game clock. The server holds three games in four; a set goes to the first to 6 games by 2 clear,
/// or 7-6 after a tiebreak at 6-6; the match to the first to win most of its sets (2 of 3). A match made
/// up for a tennis league the team list supplies is scored as a generic countdown game.
/// </summary>
internal sealed class TennisMatchPlay(League league) : SidesPlay
{
    private readonly CountdownPlay _madeUp = new(league, new(1.4, [(1, 1.0)], 6, null));

    private const double HoldChance = 0.75;

    /// <summary>About how many games a match has for each set it can last: a best of three about 24 in its planned length.</summary>
    private const int GamesPerSet = 8;

    internal override Played TakeOn(ProviderGame game, double sinceStart) => new(Taken(game), Math.Clamp(sinceStart, 0, 1));

    internal override Played Start(ProviderGame game, double step, Random random) => Step(game, 0, step, random);

    internal override Played Step(ProviderGame game, double through, double step, Random random)
    {
        var (moved, after) = Advance(game with { Status = ProviderStatus.InProgress }, through, Math.Min(1, through + step), random);
        return new(moved, after);
    }

    internal override MadeUp Live(ProviderTeam home, ProviderTeam away, double through, Random random) =>
        _madeUp.Live(home, away, through, random);

    internal override MadeUp Final(ProviderTeam home, ProviderTeam away, Random random) => _madeUp.Final(home, away, random);

    /// <summary>
    /// A match as play takes it on, with no clock and with its sets: the first time, made up (from its id)
    /// to fit shorthand scores when no sets were written. A completed set is followed by a new one at 0-0.
    /// </summary>
    private static ProviderGame Taken(ProviderGame game)
    {
        game = TennisScenario.Written(game);
        var sides = game.Sides();
        var (home, away) = (sides.Home.Score ?? 0, sides.Away.Score ?? 0);
        var sets = game.Sets;
        if (sets.Count == 0)
        {
            var random = Seeded(game.Id, "sets");
            sets = Enumerable.Repeat(true, home).Concat(Enumerable.Repeat(false, away))
                .OrderBy(_ => random.Next())
                .Select(homeWon => Won(homeWon, random))
                .Append(new ProviderSet(0, 0))
                .ToList();
        }
        if (sets[^1].HomeWon is not null)
            sets = sets.Append(new ProviderSet(0, 0)).ToList();
        return game with
        {
            Contest = new ProviderSides(sides.Home with { Score = home }, sides.Away with { Score = away }),
            Sets = sets,
            Period = sets.Count,
            DisplayClock = null,
            Phase = ProviderPeriodPhase.Playing,
        };
    }

    /// <summary>
    /// The match moved on from <paramref name="before"/> to <paramref name="through"/> of its planned
    /// length, perhaps by a game. It is Final once a player has won most of its sets, and never before,
    /// however long it runs.
    /// </summary>
    private (ProviderGame Game, double Through) Advance(ProviderGame game, double before, double through, Random random)
    {
        game = Taken(game);
        if (random.NextDouble() >= GamesPerSet * league.Regulation * (through - before))
            return (game, Math.Min(through, 0.99));

        var sets = game.Sets.ToList();
        sets[^1] = Next(sets[^1], homeServing: sets.Sum(set => set.Home + set.Away) % 2 == 0, random);
        var (home, away) = (sets.Count(set => set.HomeWon == true), sets.Count(set => set.HomeWon == false));
        var over = Math.Max(home, away) > league.Regulation / 2;
        if (sets[^1].HomeWon is not null && !over)
            sets.Add(new ProviderSet(0, 0));
        var sides = game.Sides();
        game = game with
        {
            Contest = new ProviderSides(sides.Home with { Score = home }, sides.Away with { Score = away }),
            Sets = sets,
            Period = sets.Count,
        };
        return over ? (game with { Status = ProviderStatus.Final }, 1) : (game, Math.Min(through, 0.99));
    }

    /// <summary>The set being played after its next game, won if that game wins it.</summary>
    private static ProviderSet Next(ProviderSet set, bool homeServing, Random random)
    {
        if (set is { Home: 6, Away: 6 })
            return Won(random.Next(2) == 0, random, tiebreak: true);
        var homeWins = random.NextDouble() < HoldChance == homeServing;
        set = homeWins ? set with { Home = set.Home + 1 } : set with { Away = set.Away + 1 };
        return Math.Max(set.Home, set.Away) >= 6 && Math.Abs(set.Home - set.Away) >= 2 ? set with { HomeWon = homeWins } : set;
    }

    /// <summary>A set won 6-0 to 6-4, 7-5 or (perhaps only) 7-6 with the loser's tiebreak points.</summary>
    private static ProviderSet Won(bool homeWon, Random random, bool tiebreak = false)
    {
        var lost = tiebreak ? 6 : random.Next(7);
        var (games, against) = lost switch { < 5 => (6, lost), 5 => (7, 5), _ => (7, 6) };
        int? loserPoints = null, winnerPoints = null;
        if (against == 6)
        {
            var points = random.Next(7);
            (loserPoints, winnerPoints) = (points, Math.Max(7, points + 2));
        }
        return homeWon
            ? new ProviderSet(games, against, winnerPoints, loserPoints, true)
            : new ProviderSet(against, games, loserPoints, winnerPoints, false);
    }
}
