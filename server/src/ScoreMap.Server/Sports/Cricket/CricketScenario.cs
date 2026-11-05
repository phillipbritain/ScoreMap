using ScoreMap.Server.GameFeed;
using ScoreMap.Server.Games;
using ScoreMap.Server.Scenarios;
using ScoreMap.Server.Sports.Shared;
using static ScoreMap.Server.Sports.Shared.ScenarioFabrication;

namespace ScoreMap.Server.Sports;

internal sealed class CricketScenario(League league) : SportScenario(league)
{
    internal override SportPlay CreatePlay() => new CricketPlay(League);

    protected override int Capacity => 33000;
    protected override int UsualScore => 1;
    protected override string NoteText(Random random) => LegacyScenarioDetails.QualifierNote(random);
    protected override (string Line, double Total) BettingLine(Random random, ProviderTeam favourite) => LegacyScenarioDetails.GoalOdds(random, favourite);
    internal override ProviderTeam WithRecord(ProviderTeam team) => team;
    internal override bool HasPlayDetails => false;
    internal override ProviderOdds? Odds(ProviderGame game) => null;
    protected override string ScoreText(int points, Random random) => LegacyScenarioDetails.HockeyScore(points, random);
}
