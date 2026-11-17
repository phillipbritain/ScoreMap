using System.Text.Json;
using ScoreMap.Server.GameFeed;

namespace ScoreMap.Server.Scenarios;

/// <summary>
/// A real venue scenarios can put games at, from the venue list (ADR-0009, ADR-0028), with the leagues
/// that really play there and the named groups it belongs to (<c>worldwide</c>, <c>big-cities</c>,
/// <c>london</c>, <c>london-and-nearby</c>, <c>new-york</c>, <c>los-angeles</c>, <c>us-college</c> or
/// <c>written-out</c>, the race tracks, golf courses and other venues only written-out games use).
/// A game there is in one of its leagues, at home to one of that league's teams there.
/// </summary>
public sealed record ScenarioVenue(string Name, IReadOnlyList<ScenarioVenueLeague> Leagues, IReadOnlyList<string> Groups)
{
    /// <summary>The venue as a league's games there have it, or null when the league doesn't play there.</summary>
    public ScenarioVenueLeague? For(string leagueName) =>
        Leagues.FirstOrDefault(league => string.Equals(league.League, leagueName, StringComparison.OrdinalIgnoreCase));

    /// <summary>The venue as a game feed provider reports it for a game in <paramref name="league"/>.</summary>
    public ProviderVenue ToProviderVenue(ScenarioVenueLeague league, string? court = null) =>
        new(Name, league.City, league.Region, league.Country, league.Id, Court: court);

    /// <summary>The venue as each of its leagues' games have it, the same place written as each league writes it.</summary>
    public IEnumerable<ProviderVenue> ToProviderVenues() => Leagues.Select(league => ToProviderVenue(league));

    /// <summary>Reads the venue list (a JSON array of venues) from a file.</summary>
    public static IReadOnlyList<ScenarioVenue> ReadList(string path) =>
        JsonSerializer.Deserialize<List<ScenarioVenue>>(File.ReadAllText(path), new JsonSerializerOptions(JsonSerializerDefaults.Web))
        ?? throw new InvalidDataException($"The scenario venue list {path} is empty");
}

/// <summary>
/// A league's games at a venue, as ESPN's scoreboard gives them: its ESPN id for the venue (none where
/// ESPN gives none), its city, region and country written as the league writes them (MLS puts the state
/// in the city), and the league's teams whose home it is (none at a neutral site, such as a World Cup
/// ground, where any two of the league's teams can play).
/// </summary>
public sealed record ScenarioVenueLeague(
    string League, string? Id, string? City, string? Region, string? Country, IReadOnlyList<string>? Home = null)
{
    public bool IsNeutral => Home is not { Count: > 0 };
}
