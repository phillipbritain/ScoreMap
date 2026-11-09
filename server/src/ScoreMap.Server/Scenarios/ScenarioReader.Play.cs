using System.Text.Json;
using ScoreMap.Server.Games;

namespace ScoreMap.Server.Scenarios;

public static partial class ScenarioReader
{
    /// <summary>Whether the scenario plays (<c>"play": true</c>, ADR-0009).</summary>
    private static bool ReadPlays(ScenarioFile file, string scenario, string path) =>
        file.Play?.ValueKind switch
        {
            null or JsonValueKind.False => false,
            JsonValueKind.True => true,
            _ => throw new ScenarioFileException(scenario, path,
                $"play is {file.Play.Value.GetRawText()}; write \"play\": true for games that play like real games, or leave it out"),
        };

    /// <summary>
    /// The settings for a scenario's play. New games come from the venues of the scenario's
    /// <c>fill</c> group, so play needs a fill; it replaces a timeline rather than adding to one.
    /// </summary>
    private static PlaySettings ReadPlay(
        ScenarioFile file, string scenario, string path, Lists lists)
    {
        var (leagues, venues, teams) = lists;
        ScenarioFileException Problem(string problem) => new(scenario, path, $"play {problem}");

        if (file.Timeline is not null)
            throw Problem("is on, so the scenario can't have a timeline as well; use one or the other");
        if (file.Fill?.Group is not { } group || venues is null || teams is null)
            throw Problem("needs a fill: new games go to venues from the fill's group");
        return new PlaySettings(
            leagues, venues.Where(venue => venue.Groups.Contains(group)).ToList(), new ScenarioGameMaker(leagues, teams));
    }
}
