using ScoreMap.Server.Games;

namespace ScoreMap.Server.Scenarios;

public static partial class ScenarioReader
{
    /// <summary>
    /// Reads <c>"play"</c> (ADR-0009): <c>"random"</c> or <c>"live"</c>. Under random play new games
    /// come from the venues of the scenario's <c>fill</c> group, so it needs a fill; live play adds no
    /// games, so it doesn't. Either replaces a timeline rather than adding to one.
    /// </summary>
    private static RandomPlaySettings ReadPlay(
        ScenarioFile file, string scenario, string path, IReadOnlyList<League> leagues, IReadOnlyList<ScenarioVenue>? venues)
    {
        ScenarioFileException Problem(string problem) => new(scenario, path, $"play {problem}");

        // By name only: Enum.TryParse would also take a number such as "0".
        if (Enum.GetNames<PlayKind>().FirstOrDefault(n => string.Equals(n, file.Play, StringComparison.OrdinalIgnoreCase)) is not { } name)
            throw Problem($"is \"{file.Play}\"; the kinds of play are \"random\" and \"live\"");
        var kind = Enum.Parse<PlayKind>(name);
        name = name.ToLowerInvariant();
        if (file.Timeline is not null)
            throw Problem($"is {name}, so the scenario can't have a timeline as well; use one or the other");
        if (kind == PlayKind.Live)
            return new RandomPlaySettings(kind, leagues, [], null);
        if (file.Fill?.Group is not { } group || venues is null)
            throw Problem("is random, which needs a fill: new games go to venues from the fill's group");
        return new RandomPlaySettings(
            kind, leagues, venues.Where(venue => venue.Groups.Contains(group)).ToList(), new ScenarioGameMaker(leagues, venues));
    }
}
