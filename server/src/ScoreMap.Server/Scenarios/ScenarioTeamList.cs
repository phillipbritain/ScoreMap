using System.Text.Json;
using ScoreMap.Server.Games;

namespace ScoreMap.Server.Scenarios;

/// <summary>
/// The real teams scenarios make games between (ADR-0009), from the hand-written team list: each
/// league's teams under the league's name, so a made-up game is always two teams from the same league.
/// </summary>
public sealed class ScenarioTeamList(IReadOnlyDictionary<string, IReadOnlyList<ScenarioTeam>> byLeague)
{
    private readonly Dictionary<string, IReadOnlyList<ScenarioTeam>> _byLeague =
        new(byLeague, StringComparer.OrdinalIgnoreCase);

    /// <summary>The league's teams, listed under its name; none if the list doesn't have it.</summary>
    public IReadOnlyList<ScenarioTeam> For(League league) => _byLeague.GetValueOrDefault(league.Name) ?? [];

    /// <summary>Reads the team list (a JSON object of league names, each with an array of teams) from a file.</summary>
    public static ScenarioTeamList Read(string path) =>
        new(JsonSerializer.Deserialize<Dictionary<string, IReadOnlyList<ScenarioTeam>>>(
                File.ReadAllText(path), new JsonSerializerOptions(JsonSerializerDefaults.Web))
            ?? throw new InvalidDataException($"The scenario team list {path} is empty"));
}

/// <summary>A real team: full name, abbreviation and ESPN logo URL.</summary>
public sealed record ScenarioTeam(string Name, string Abbreviation, string? LogoUrl);
