using ScoreMap.Server.GameFeed;

namespace ScoreMap.Server.Scenarios;

public sealed partial class ScenarioPlay
{
    private void PlayContest(PlayedGame played, DateTimeOffset at)
    {
        var before = played.Through;
        var through = Math.Min(1, before + Step / played.League.PlannedLength);
        (played.Game, played.Through) = played.Scenario.PlayContest(played.Game, before, through, _random);
        if (played.Game.Status == ProviderStatus.Final)
            played.StoppedAt = at;
    }
}
