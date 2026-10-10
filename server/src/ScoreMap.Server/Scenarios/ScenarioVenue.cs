using System.Text.Json;
using ScoreMap.Server.GameFeed;

namespace ScoreMap.Server.Scenarios;

/// <summary>
/// A real venue scenarios can put games at, from the hand-written venue list (ADR-0009), with the
/// named groups it belongs to (<c>worldwide</c>, <c>big-cities</c>, <c>london</c>, <c>london-and-nearby</c>,
/// <c>new-york</c> or <c>los-angeles</c>). Any game can be at any venue: its teams come from the team
/// list, not the venue.
/// </summary>
public sealed record ScenarioVenue(
    string Name,
    string City,
    string? Region,
    string Country,
    IReadOnlyList<string> Groups)
{
    /// <summary>The venue as a game feed provider reports it.</summary>
    public ProviderVenue ToProviderVenue() => new(Name, City, Region, Country);

    /// <summary>Reads the venue list (a JSON array of venues) from a file.</summary>
    public static IReadOnlyList<ScenarioVenue> ReadList(string path) =>
        JsonSerializer.Deserialize<List<ScenarioVenue>>(File.ReadAllText(path), new JsonSerializerOptions(JsonSerializerDefaults.Web))
        ?? throw new InvalidDataException($"The scenario venue list {path} is empty");
}
