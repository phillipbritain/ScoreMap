using ScoreMap.Server.Games;
using ScoreMap.Server.Scenarios;

namespace ScoreMap.Server.Tests.Scenarios;

/// <summary>Venues for scenario tests.</summary>
internal static class ScenarioTestVenues
{
    /// <summary>A neutral site for every one of <paramref name="leagues"/>: a game there can be in any of them, between any two of its teams.</summary>
    public static ScenarioVenue Neutral(string name, string city, string? region, string? country, IEnumerable<League> leagues, params string[] groups) =>
        new(name, leagues.Select(league => new ScenarioVenueLeague(league.Name, null, city, region, country)).ToList(), groups);
}
