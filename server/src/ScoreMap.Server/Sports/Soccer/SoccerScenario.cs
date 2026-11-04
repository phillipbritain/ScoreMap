using ScoreMap.Server.GameFeed;
using ScoreMap.Server.Games;
using ScoreMap.Server.Scenarios;
using ScoreMap.Server.Sports.Shared;

using static ScoreMap.Server.Sports.Shared.ScenarioFabrication;

namespace ScoreMap.Server.Sports;

internal sealed partial class SoccerScenario(League league) : SportScenario(league)
{
    protected override FieldPlay Field => RacingFieldPlay.Instance;

    internal override SportPlay CreatePlay() => new MinutePlay(League, new(1.4, [(1, 1.0)], 6, null));
    protected override int Capacity => 45000;
    protected override int UsualScore => 1;
    protected override string NoteText(Random random) => Pick(random, "1st Leg", $"2nd Leg - Aggregate {random.Next(4)}-{random.Next(4)}", "Derby");
    protected override (string Line, double Total) BettingLine(Random random, ProviderTeam favourite) => LegacyScenarioDetails.GoalOdds(random, favourite);
    protected override int PlayedGames(Random random) => random.Next(3, 30);
    protected override string Record(Random random, int played, int wins)
    {
        var draws = random.Next(played - wins + 1);
        return $"{wins}-{draws}-{played - wins - draws}";
    }
    protected override string ScoreText(int points, Random random) => LegacyScenarioDetails.HockeyScore(points, random);

    internal override int Minute(ProviderGame game) => MinuteEvents.At(game, League);

    internal override (ProviderScoringPlay? LastScore, IReadOnlyList<ProviderKeyEvent> KeyEvents) Events(ProviderGame game, ScenarioSeen? seen, int minute)
    {
        var events = seen?.KeyEvents.ToList() ?? [];
        var from = seen?.Minute ?? 0;
        var sides = game.Sides();
        var (home, away) = (sides.Home.Score ?? 0, sides.Away.Score ?? 0);
        var goals = new List<(int Minute, ProviderTeam Team)>();
        void GoalsFor(ProviderTeam team, int had, int has)
        {
            for (var goal = had + 1; goal <= has; goal++)
                goals.Add((seen is null ? Seeded(game.Id, $"{team.Abbreviation} {goal}").Next(1, Math.Max(2, minute)) : minute, team));
        }
        GoalsFor(sides.Home, seen?.Home ?? 0, home);
        GoalsFor(sides.Away, seen?.Away ?? 0, away);
        foreach (var (at, team) in goals)
        {
            var random = Seeded(game.Id, $"goal {team.Abbreviation} {at}");
            var kind = random.NextDouble() switch { < 0.1 => KeyEventKind.PenaltyGoal, < 0.13 => KeyEventKind.OwnGoal, _ => KeyEventKind.Goal };
            events.Add(new ProviderKeyEvent(kind, team.Abbreviation, Player(random), $"{at}'"));
        }
        MinuteEvents.Cards(events, game, from, minute, chance: 0.035, redChance: 0.003);
        return MinuteEvents.InOrder(events, kind => kind switch { KeyEventKind.PenaltyGoal => "Penalty", KeyEventKind.OwnGoal => "Own goal", _ => "Goal" });
    }
}
