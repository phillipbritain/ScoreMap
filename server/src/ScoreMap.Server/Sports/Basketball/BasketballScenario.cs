using ScoreMap.Server.GameFeed;
using ScoreMap.Server.Games;
using ScoreMap.Server.Scenarios;
using ScoreMap.Server.Sports.Shared;
using static ScoreMap.Server.Sports.Shared.ScenarioFabrication;

namespace ScoreMap.Server.Sports;

internal sealed class BasketballScenario(League league) : SportScenario(league)
{
    protected override FieldPlay Field => RacingFieldPlay.Instance;

    private readonly BasketballScenarioFormat _format = BasketballScenarioFormat.For(league);

    internal override SportPlay CreatePlay() => new CountdownPlay(League, _format.Scoring);

    protected override int Capacity => 18500;
    protected override int UsualScore => 2;
    protected override string NoteText(Random random) => Pick(random, "Play-In Tournament", $"Conference Semifinals - Game {random.Next(1, 8)}", "Cup Knockout Round");
    protected override (string Line, double Total) BettingLine(Random random, ProviderTeam favourite) =>
        ($"{favourite.Abbreviation} -{Number(Between(random, 1, _format.SpreadMax, 0.5))}", Between(random, _format.TotalMin, _format.TotalMax, 1));

    protected override string ScoreText(int points, Random random) => points switch
    {
        1 => $"{Player(random)} makes free throw {Pick(random, "1 of 2", "2 of 2", "1 of 1")}",
        2 => $"{Player(random)} makes {Pick(random, $"{random.Next(2, 20)}-foot jumper", "driving layup", "dunk", "two point shot")} ({Player(random)} assists)",
        _ => $"{Player(random)} makes {random.Next(23, 30)}-foot three point jumper ({Player(random)} assists)",
    };

    internal override ProviderSituation? Situation(ProviderGame game)
    {
        var random = SituationRandom(game);
        return new ProviderSituation(Pick(random,
            $"{Player(random)} defensive rebound",
            $"{Player(random)} misses {random.Next(10, 27)}-foot jumper",
            $"{Player(random)} bad pass (stolen by {Player(random)})",
            $"{Player(random)} shooting foul"));
    }
}
