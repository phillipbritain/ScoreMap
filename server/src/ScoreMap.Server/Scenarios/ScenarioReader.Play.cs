using ScoreMap.Server.Games;

namespace ScoreMap.Server.Scenarios;

public static partial class ScenarioReader
{
    /// <summary>
    /// Reads <c>"play": "random"</c> (ADR-0009). New games come from the venues of the scenario's
    /// <c>fill</c> group, so random play needs a fill; and it replaces a timeline rather than adding to one.
    /// </summary>
    private static RandomPlaySettings ReadPlay(
        ScenarioFile file, string scenario, string path, IReadOnlyList<League> leagues, IReadOnlyList<ScenarioVenue>? venues)
    {
        ScenarioFileException Problem(string problem) => new(scenario, path, $"play {problem}");

        if (!string.Equals(file.Play, "random", StringComparison.OrdinalIgnoreCase))
            throw Problem($"is \"{file.Play}\"; the only kind of play is \"random\"");
        if (file.Fill?.Group is not { } group || venues is null)
            throw Problem("is random, which needs a fill: new games go to venues from the fill's group");
        if (file.Timeline is not null)
            throw Problem("is random, so the scenario can't have a timeline as well; use one or the other");
        return new RandomPlaySettings(leagues, venues.Where(venue => venue.Groups.Contains(group)).ToList(), new ScenarioGameMaker(leagues, venues));
    }
}
