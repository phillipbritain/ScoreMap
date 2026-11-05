using ScoreMap.Server.GameFeed;
using ScoreMap.Server.Games;
using ScoreMap.Server.Scenarios;
using ScoreMap.Server.Sports.Shared;
using static ScoreMap.Server.Sports.Shared.ScenarioFabrication;

namespace ScoreMap.Server.Sports;

internal sealed class HockeyScenario(League league) : SportScenario(league)
{
    internal override SportPlay CreatePlay() => new CountdownPlay(League, new(3, [(1, 1.0)], 7, 1));

    protected override int Capacity => 18500;
    protected override int UsualScore => 1;
    protected override string NoteText(Random random) => Pick(random, $"First Round - Game {random.Next(1, 8)}", "Outdoor Game", "Rivalry Night");
    protected override (string Line, double Total) BettingLine(Random random, ProviderTeam favourite) =>
        ($"{favourite.Abbreviation} -{random.Next(110, 200)}", Between(random, 5.5, 6.5, 1));
    protected override string Record(Random random, int played, int wins)
    {
        var overtime = random.Next((played - wins) / 3 + 1);
        return $"{wins}-{played - wins - overtime}-{overtime}";
    }
    protected override string ScoreText(int points, Random random) => LegacyScenarioDetails.HockeyScore(points, random);

    internal override ProviderSituation? Situation(ProviderGame game)
    {
        var random = SituationRandom(game);
        return new ProviderSituation(Pick(random,
            $"{Player(random)} won faceoff against {Player(random)}",
            $"Shot on goal by {Player(random)} saved by {Player(random)}",
            $"{Player(random)} hit {Player(random)}",
            $"Takeaway by {Player(random)}"));
    }
}
