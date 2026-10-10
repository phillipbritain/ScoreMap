using System.Text.Json;
using ScoreMap.Server.GameFeed;
using ScoreMap.Server.Games;

namespace ScoreMap.Server.Scenarios;

/// <summary>
/// Reads a scenario file (<c>&lt;name&gt;.json</c> in the scenarios folder) and checks it against the
/// configured leagues. Anything wrong with the file throws a <see cref="ScenarioFileException"/> that
/// says what and where, so a bad file stops startup with a clear message.
/// </summary>
public static partial class ScenarioReader
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

    /// <summary>
    /// Reads scenario <paramref name="name"/> from <paramref name="folder"/>. Written-out games must be
    /// at venues in <paramref name="venues"/>, the venue list, unless marked <c>notInVenueList</c>, and
    /// a <c>fill</c> takes its games from it.
    /// </summary>
    public static Scenario Read(string folder, string name, IReadOnlyList<League> leagues, IReadOnlyList<ScenarioVenue>? venues = null)
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

        var ids = new HashSet<string>();
        var games = (file.Games ?? []).Select((entry, i) =>
        {
            try
            {
                var game = ReadGame(entry, i, name, leagues, venues);
                if (!ids.Add(game.Id))
                    throw new InvalidDataException("has the same id as an earlier game; each game needs its own");
                return game;
            }
            catch (InvalidDataException e)
            {
                var id = entry?.Id is { } given ? $" (\"{given}\")" : "";
                throw new ScenarioFileException(name, path, $"game {i + 1}{id} {e.Message}");
            }
        }).ToList();
        var (plays, disruptedShare) = ReadPlays(file, name, path);
        if (file.Fill is not null)
        {
            foreach (var game in ReadFill(file.Fill, disruptedShare, name, path, leagues, venues))
            {
                if (!ids.Add(game.Id))
                    throw new ScenarioFileException(name, path,
                        $"a written-out game has the id \"{game.Id}\", which fill gives to one of its games; pick another");
                games.Add(game);
            }
        }
        var timeline = file.Timeline is null ? null : ReadTimeline(file.Timeline, games, name, path);
        var play = plays ? ReadPlay(file, disruptedShare, name, path, leagues, venues) : null;
        return new Scenario(name, games, timeline, play);
    }

    /// <summary>Reads one game written out in full; throws <see cref="InvalidDataException"/> saying what's wrong with it.</summary>
    private static ScenarioGame ReadGame(
        GameEntry? entry, int index, string scenario, IReadOnlyList<League> leagues, IReadOnlyList<ScenarioVenue>? venues)
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
        var status = ReadStatus(entry.Status);
        var phase = ReadPhase(entry.Phase);
        var home = ReadTeam(entry.Home, "home");
        var away = ReadTeam(entry.Away, "away");
        var venue = ReadVenue(entry.Venue, venues);

        return new ScenarioGame(
            Id: entry.Id ?? $"{scenario}-{index + 1}",
            LeagueKey: league.Key,
            StartsIn: startsIn,
            Home: home,
            Away: away,
            Venue: venue,
            Status: status,
            Clock: entry.Clock,
            Period: entry.Period,
            Phase: phase);
    }

    /// <summary>
    /// A written-out game's venue, which must be in the venue list (known by name and city, as the
    /// venue locator looks it up), so a misspelt one can't quietly go to Nominatim. A venue made up on
    /// purpose says so with <c>"notInVenueList": true</c>. Parts of a listed venue left out are taken
    /// from the list; parts written must agree with it.
    /// </summary>
    private static ProviderVenue ReadVenue(VenueEntry? entry, IReadOnlyList<ScenarioVenue>? venues)
    {
        if (entry is null || string.IsNullOrWhiteSpace(entry.Name))
            throw new InvalidDataException("has no venue (a venue needs at least a name)");
        var written = $"\"{entry.Name}\" in {entry.City ?? "no city"}";
        if (venues is null)
            throw new InvalidDataException(
                $"has venue {written}, but there is no venue list to check it against");
        var listed = venues.SingleOrDefault(v => v.Name == entry.Name && v.City == entry.City);
        if (entry.NotInVenueList)
        {
            if (listed is not null)
                throw new InvalidDataException(
                    $"has venue {written}, which is in the venue list; drop \"notInVenueList\"");
            return new ProviderVenue(entry.Name, entry.City, entry.Region, entry.Country);
        }
        if (listed is null)
        {
            var cities = venues.Where(v => v.Name == entry.Name).Select(v => v.City).ToList();
            throw new InvalidDataException(
                $"has unknown venue {written}"
                + (cities.Count > 0 ? $"; the venue list has it in {string.Join(", ", cities)}" : "; it isn't in the venue list")
                + ". Use a venue from the list, or mark one made up on purpose with \"notInVenueList\": true");
        }
        if (entry.Region is not null && entry.Region != listed.Region)
            throw new InvalidDataException(
                $"has venue {written} with region \"{entry.Region}\", but the venue list has \"{listed.Region}\"");
        if (entry.Country is not null && entry.Country != listed.Country)
            throw new InvalidDataException(
                $"has venue {written} with country \"{entry.Country}\", but the venue list has \"{listed.Country}\"");
        return listed.ToProviderVenue();
    }

    private static ProviderStatus ReadStatus(string? status) =>
        status is not null && Statuses.TryGetValue(status, out var read)
            ? read
            : throw new InvalidDataException(
                $"has unknown status \"{status}\"; use one of {string.Join(", ", Statuses.Keys)}");

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

    // The file's own shape, kept apart from the model so the format can grow.
    private sealed record ScenarioFile(
        List<GameEntry?>? Games, TimelineEntry? Timeline, FillEntry? Fill, JsonElement? Play, double? Disrupted);

    private sealed record GameEntry(
        string? Id, string? League, TeamEntry? Home, TeamEntry? Away, VenueEntry? Venue,
        string? StartsIn, string? Status, string? Clock, int? Period, string? Phase);

    private sealed record TeamEntry(string? Name, string? Abbreviation, string? Logo, int? Score);

    private sealed record VenueEntry(string? Name, string? City, string? Region, string? Country, bool NotInVenueList = false);
}

/// <summary>A scenario file that can't be used, and why.</summary>
public sealed class ScenarioFileException(string scenario, string path, string problem)
    : Exception($"Scenario \"{scenario}\" can't be used ({path}): {problem}");
