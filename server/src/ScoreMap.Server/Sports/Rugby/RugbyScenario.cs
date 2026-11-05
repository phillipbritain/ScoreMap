using ScoreMap.Server.GameFeed;
using ScoreMap.Server.Games;
using ScoreMap.Server.Scenarios;
using ScoreMap.Server.Sports.Shared;
using static ScoreMap.Server.Sports.Shared.ScenarioFabrication;

namespace ScoreMap.Server.Sports;

internal sealed class RugbyScenario(League league) : SportScenario(league)
{
    private static readonly (int Points, double Chance)[] Scores = [(7, 0.4), (5, 0.2), (3, 0.4)];
    internal override SportPlay CreatePlay() => new MinutePlay(League, new(5.5, Scores, 60, null));

    protected override int Capacity => 65000;
    protected override int UsualScore => 1;
    protected override string NoteText(Random random) => Pick(random, "Round 3", "Triple Crown decider", "Grand Slam decider");
    protected override (string Line, double Total) BettingLine(Random random, ProviderTeam favourite) =>
        ($"{favourite.Abbreviation} -{Number(Between(random, 1.5, 20.5, 1))}", Between(random, 38.5, 55.5, 1));
    internal override ProviderTeam WithRecord(ProviderTeam team) => team;
    protected override string ScoreText(int points, Random random) => LegacyScenarioDetails.HockeyScore(points, random);

    internal override int Minute(ProviderGame game) => MinuteEvents.At(game, League);

    internal override (ProviderScoringPlay? LastScore, IReadOnlyList<ProviderKeyEvent> KeyEvents) Events(ProviderGame game, ScenarioSeen? seen, int minute)
    {
        var events = seen?.KeyEvents.ToList() ?? [];
        var sides = game.Sides();
        void ScoresFor(ProviderTeam team, int had, int has)
        {
            var random = Seeded(game.Id, $"{team.Abbreviation} {had}-{has}");
            for (var left = has - had; left > 0;)
            {
                var points = RugbyScore(left, random);
                if (points < 2)
                    break;
                var at = seen is null ? random.Next(1, Math.Max(2, minute)) : minute;
                KeyEventKind[] kinds = points switch
                {
                    7 => [KeyEventKind.Try, KeyEventKind.Conversion],
                    5 => [KeyEventKind.Try],
                    3 => [random.NextDouble() < 0.1 ? KeyEventKind.DropGoal : KeyEventKind.PenaltyGoal],
                    _ => [KeyEventKind.Conversion],
                };
                var kicker = Player(random);
                events.AddRange(kinds.Select(kind =>
                    new ProviderKeyEvent(kind, team.Abbreviation, kind == KeyEventKind.Try ? Player(random) : kicker, $"{at}'")));
                left -= points;
            }
        }
        ScoresFor(sides.Home, seen?.Home ?? 0, sides.Home.Score ?? 0);
        ScoresFor(sides.Away, seen?.Away ?? 0, sides.Away.Score ?? 0);
        MinuteEvents.Cards(events, game, seen?.Minute ?? 0, minute, chance: 0.02, redChance: 0.002);
        return MinuteEvents.InOrder(events, kind => kind switch
        {
            KeyEventKind.Try => "Try",
            KeyEventKind.Conversion => "Conversion",
            KeyEventKind.DropGoal => "Drop goal",
            _ => "Penalty goal",
        });
    }

    private static int RugbyScore(int left, Random random)
    {
        static bool AddsUp(int points) => points is 0 or 3 or >= 5;
        var fits = Scores.Where(score => AddsUp(left - score.Points)).ToArray();
        if (fits.Length == 0)
            return Math.Min(left, 2);
        var roll = random.NextDouble() * fits.Sum(score => score.Chance);
        foreach (var (points, chance) in fits)
        {
            if (roll < chance)
                return points;
            roll -= chance;
        }
        return fits[^1].Points;
    }
}
