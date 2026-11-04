using ScoreMap.Server.GameFeed;
using ScoreMap.Server.Games;
using ScoreMap.Server.Sports;
using ScoreMap.Server.Sports.Shared;

namespace ScoreMap.Server.Scenarios;

/// <summary>Routes scenario detail to its league-bound sport session; unknown leagues pass through.</summary>
internal sealed class ScenarioDetails(IReadOnlyList<League> leagues)
{
    private readonly Dictionary<string, SportScenarioDetails> _details = leagues.ToDictionary(
        league => league.Key, league => ScenarioSports.For(league).CreateDetails());

    // Calls are serialized by the scenario provider, as are the sport sessions they use.
    public IReadOnlyList<ProviderGame> Fill(string leagueKey, IReadOnlyList<ProviderGame> games) =>
        _details.TryGetValue(leagueKey, out var details) ? details.Fill(games) : games;
}
