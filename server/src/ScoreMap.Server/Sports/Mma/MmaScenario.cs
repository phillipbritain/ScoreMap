using ScoreMap.Server.GameFeed;
using ScoreMap.Server.Games;
using ScoreMap.Server.Scenarios;
using ScoreMap.Server.Sports.Shared;

using static ScoreMap.Server.Sports.Shared.ScenarioFabrication;

namespace ScoreMap.Server.Sports;

internal sealed partial class MmaScenario(League league) : SportScenario(league)
{
    protected override FieldPlay Field => RacingFieldPlay.Instance;

    // Preserve the existing two-sided fill behaviour; this does not add specialized fill support.
    internal override SportPlay CreatePlay() => new CountdownPlay(League, new(1.4, [(1, 1.0)], 6, null));
    protected override int Capacity => 18500;
    protected override int UsualScore => 1;
    protected override string NoteText(Random random) => LegacyScenarioDetails.QualifierNote(random);
    protected override (string Line, double Total) BettingLine(Random random, ProviderTeam favourite) => LegacyScenarioDetails.GoalOdds(random, favourite);
    protected override string ScoreText(int points, Random random) => LegacyScenarioDetails.HockeyScore(points, random);
}
