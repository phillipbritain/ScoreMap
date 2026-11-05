using ScoreMap.Server.GameFeed;
using ScoreMap.Server.Games;
using ScoreMap.Server.Scenarios;
using ScoreMap.Server.Sports.Shared;

namespace ScoreMap.Server.Sports;

/// <summary>
/// Cricket in a scenario has a crowd and a note, but as live (ESPN gives none) no records, odds or
/// last score.
/// </summary>
internal sealed class CricketScenario(League league) : SportScenario(league)
{
    internal override SportPlay CreatePlay() => new CricketPlay(League);

    protected override int? Capacity => 33000;
    protected override string NoteText(Random random) => LegacyScenarioDetails.QualifierNote(random);
    internal override ProviderTeam WithRecord(ProviderTeam team) => team;
    internal override bool HasPlayDetails => false;
}
