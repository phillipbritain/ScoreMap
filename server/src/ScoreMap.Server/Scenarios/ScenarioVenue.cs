using System.Text.Json;
using ScoreMap.Server.GameFeed;

namespace ScoreMap.Server.Scenarios;

/// <summary>
/// A real venue scenarios can put games at, from the hand-written venue list (ADR-0009), with its
/// real home team and the named groups it belongs to (every venue is in <c>worldwide</c>; some are
/// also in <c>london</c>, <c>new-york</c> or <c>los-angeles</c>).
/// </summary>
public sealed record ScenarioVenue(
    string Name,
    string City,
    string? Region,
    string Country,
    ScenarioTeam HomeTeam,
    IReadOnlyList<string> Groups)
{
    /// <summary>The venue as a game feed provider reports it.</summary>
    public ProviderVenue ToProviderVenue() => new(Name, City, Region, Country);

    /// <summary>Reads the venue list (a JSON array of venues) from a file.</summary>
    public static IReadOnlyList<ScenarioVenue> ReadList(string path) =>
        JsonSerializer.Deserialize<List<ScenarioVenue>>(File.ReadAllText(path), new JsonSerializerOptions(JsonSerializerDefaults.Web))
        ?? throw new InvalidDataException($"The scenario venue list {path} is empty");
}

/// <summary>A venue's real home team: full name, abbreviation and ESPN logo URL.</summary>
public sealed record ScenarioTeam(string Name, string Abbreviation, string? LogoUrl);
