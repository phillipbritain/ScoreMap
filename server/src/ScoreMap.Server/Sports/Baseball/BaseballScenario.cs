using ScoreMap.Server.GameFeed;
using ScoreMap.Server.Games;
using ScoreMap.Server.Scenarios;
using ScoreMap.Server.Sports.Shared;

using static ScoreMap.Server.Sports.Shared.ScenarioFabrication;

namespace ScoreMap.Server.Sports;

internal sealed partial class BaseballScenario(League league) : SportScenario(league)
{
    protected override FieldPlay Field => RacingFieldPlay.Instance;

    internal override SportPlay CreatePlay() => new BaseballPlay(League, new(3, [(1, 0.65), (2, 0.25), (3, 0.08), (4, 0.02)], 11, 1));
    protected override int Capacity => 40000;
    protected override int UsualScore => 1;
    protected override string NoteText(Random random) => Pick(random, $"Division Series - Game {random.Next(1, 6)}", "Doubleheader - Game 2", "Inclement Weather - Makeup date");
    protected override (string Line, double Total) BettingLine(Random random, ProviderTeam favourite) =>
        ($"{favourite.Abbreviation} -{random.Next(110, 220)}", Between(random, 6.5, 10.5, 0.5));
    protected override int PlayedGames(Random random) => random.Next(20, 150);

    protected override string ScoreText(int runs, Random random) => runs switch
    {
        1 when random.Next(3) == 0 => $"{Player(random)} homered to {Pick(random, "left", "center", "right")} ({random.Next(340, 460)} feet).",
        1 => $"{Player(random)} {Pick(random, "singled", "doubled", "hit a sacrifice fly")} to {Pick(random, "left", "center", "right")}, {Player(random)} scored.",
        4 => $"{Player(random)} hit a grand slam to {Pick(random, "left", "center", "right")} ({random.Next(360, 460)} feet).",
        _ => $"{Player(random)} {Pick(random, "doubled", "tripled", "homered")} to {Pick(random, "left", "center", "right")}, {runs} runs scored.",
    };
    protected override ProviderPeriodPhase ScorePhase(ProviderGame game) => game.Phase;
    protected override string? ScoreClock(ProviderGame game) => null;

    internal override ProviderSituation? Situation(ProviderGame game)
    {
        var random = SituationRandom(game);
        return new ProviderSituation(
            Pick(random, $"{Player(random)} struck out swinging.", $"{Player(random)} grounded out to second.", $"{Player(random)} flied out to center.", $"{Player(random)} walked."),
            Balls: random.Next(4), Strikes: random.Next(3), Outs: random.Next(3),
            OnFirst: random.NextDouble() < 0.35, OnSecond: random.NextDouble() < 0.25, OnThird: random.NextDouble() < 0.15);
    }
}
