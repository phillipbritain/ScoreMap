using System.Text.Json;
using ScoreMap.Server.GameFeed;
using ScoreMap.Server.Games;

namespace ScoreMap.Server.Scenarios;

/// <summary>
/// Reads a scenario file (<c>&lt;name&gt;.json</c> in the scenarios folder) and checks it against the
/// configured leagues. Anything wrong with the file throws a <see cref="ScenarioFileException"/> that
/// says what and where, so a bad file stops startup with a clear message.
/// </summary>
public static class ScenarioReader
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web)
    {
        ReadCommentHandling = JsonCommentHandling.Skip,
        AllowTrailingCommas = true,
    };

    // Statuses as scenario files write them.
    private static readonly Dictionary<string, ProviderStatus> Statuses = new(StringComparer.OrdinalIgnoreCase)
    {
        ["upcoming"] = ProviderStatus.Scheduled,
        ["live"] = ProviderStatus.InProgress,
        ["delayed"] = ProviderStatus.Delayed,
        ["final"] = ProviderStatus.Final,
        ["postponed"] = ProviderStatus.Postponed,
        ["suspended"] = ProviderStatus.Suspended,
        ["canceled"] = ProviderStatus.Canceled,
    };

    public static Scenario Read(string folder, string name, IReadOnlyList<League> leagues)
    {
        var path = Path.GetFullPath(Path.Combine(folder, $"{name}.json"));
        if (!File.Exists(path))
            throw new ScenarioFileException(name, path, "there is no such file");

        ScenarioFile? file;
        try
        {
            file = JsonSerializer.Deserialize<ScenarioFile>(File.ReadAllText(path), Json);
        }
        catch (JsonException e)
        {
            throw new ScenarioFileException(name, path, $"it isn't valid JSON: {e.Message}");
        }
        if (file is null)
            throw new ScenarioFileException(name, path, "it is empty");

        var games = (file.Games ?? []).Select((entry, i) =>
        {
            try
            {
                return ReadGame(entry, i, name, leagues);
            }
            catch (InvalidDataException e)
            {
                var id = entry?.Id is { } given ? $" (\"{given}\")" : "";
                throw new ScenarioFileException(name, path, $"game {i + 1}{id} {e.Message}");
            }
        }).ToList();
        return new Scenario(name, games);
    }

    /// <summary>Reads one game written out in full; throws <see cref="InvalidDataException"/> saying what's wrong with it.</summary>
    private static ScenarioGame ReadGame(GameEntry? entry, int index, string scenario, IReadOnlyList<League> leagues)
    {
        if (entry is null)
            throw new InvalidDataException("is empty");
        var league = leagues.FirstOrDefault(l =>
                string.Equals(l.Name, entry.League, StringComparison.OrdinalIgnoreCase) || l.Key == entry.League)
            ?? throw new InvalidDataException(
                $"has unknown league \"{entry.League}\"; the configured leagues are {string.Join(", ", leagues.Select(l => l.Name))}");
        if (!RelativeTime.TryParse(entry.StartsIn, out var startsIn))
            throw new InvalidDataException(
                $"has startsIn \"{entry.StartsIn}\", which isn't a time relative to the scenario's start such as \"-40m\" or \"1h30m\"");
        if (entry.Status is null || !Statuses.TryGetValue(entry.Status, out var status))
            throw new InvalidDataException(
                $"has unknown status \"{entry.Status}\"; use one of {string.Join(", ", Statuses.Keys)}");
        var phase = ReadPhase(entry.Phase);
        if (string.IsNullOrWhiteSpace(entry.Venue?.Name))
            throw new InvalidDataException("has no venue (a venue needs at least a name)");

        return new ScenarioGame(
            Id: entry.Id ?? $"{scenario}-{index + 1}",
            LeagueKey: league.Key,
            StartsIn: startsIn,
            Home: ReadTeam(entry.Home, "home"),
            Away: ReadTeam(entry.Away, "away"),
            Venue: new ProviderVenue(entry.Venue.Name, entry.Venue.City, entry.Venue.Region, entry.Venue.Country),
            Status: status,
            Clock: entry.Clock,
            Period: entry.Period,
            Phase: phase);
    }

    private static ProviderPeriodPhase ReadPhase(string? phase)
    {
        if (phase is null)
            return ProviderPeriodPhase.Playing;
        if (!int.TryParse(phase, out _) && Enum.TryParse<ProviderPeriodPhase>(phase, ignoreCase: true, out var read))
            return read;
        throw new InvalidDataException(
            $"has unknown phase \"{phase}\"; use one of {string.Join(", ", Enum.GetNames<ProviderPeriodPhase>())}");
    }

    private static ProviderTeam ReadTeam(TeamEntry? team, string side)
    {
        if (team is null)
            throw new InvalidDataException($"has no {side} team");
        if (string.IsNullOrWhiteSpace(team.Name) || string.IsNullOrWhiteSpace(team.Abbreviation))
            throw new InvalidDataException($"has a {side} team with no name or abbreviation");
        return new ProviderTeam(team.Abbreviation, team.Name, team.Logo, team.Score);
    }

    // The file's own shape, kept apart from the model so the format can grow (timelines, fill, random play).
    private sealed record ScenarioFile(List<GameEntry?>? Games);

    private sealed record GameEntry(
        string? Id, string? League, TeamEntry? Home, TeamEntry? Away, VenueEntry? Venue,
        string? StartsIn, string? Status, string? Clock, int? Period, string? Phase);

    private sealed record TeamEntry(string? Name, string? Abbreviation, string? Logo, int? Score);

    private sealed record VenueEntry(string? Name, string? City, string? Region, string? Country);
}

/// <summary>A scenario file that can't be used, and why.</summary>
public sealed class ScenarioFileException(string scenario, string path, string problem)
    : Exception($"Scenario \"{scenario}\" can't be used ({path}): {problem}");
