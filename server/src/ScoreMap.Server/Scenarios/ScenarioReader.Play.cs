using System.Text.Json;
using ScoreMap.Server.Games;

namespace ScoreMap.Server.Scenarios;

public static partial class ScenarioReader
{
    /// <summary>The share of the games showing that are Disrupted under play, when a scenario leaves <c>"disrupted"</c> out.</summary>
    public const double DefaultDisruptedShare = 0.05;

    /// <summary>
    /// Whether the scenario plays (<c>"play": true</c>, ADR-0009), and the share of its games that are
    /// Disrupted (<c>"disrupted"</c>): <see cref="DefaultDisruptedShare"/> if left out, and none without
    /// play, which rejects the field since nothing would act on it.
    /// </summary>
    private static (bool Plays, double DisruptedShare) ReadPlayAndShare(ScenarioFile file, string scenario, string path)
    {
        var plays = file.Play?.ValueKind switch
        {
            null or JsonValueKind.False => false,
            JsonValueKind.True => true,
            _ => throw new ScenarioFileException(scenario, path,
                $"play is {file.Play.Value.GetRawText()}; write \"play\": true for games that play like real games, or leave it out"),
        };
        if (!plays)
        {
            if (file.Disrupted is not null)
                throw new ScenarioFileException(scenario, path,
                    "disrupted is set on a scenario without play, where nothing would act on it; add \"play\": true or drop it");
            return (false, 0);
        }
        if (file.Disrupted is < 0 or > 1)
            throw new ScenarioFileException(scenario, path,
                $"disrupted is {file.Disrupted}; it's the share of the games that are Disrupted, between 0 and 1, such as 0.05");
        return (true, file.Disrupted ?? DefaultDisruptedShare);
    }

    /// <summary>
    /// The settings for a scenario's play. New games come from the venues of the scenario's
    /// <c>fill</c> group, so play needs a fill; it replaces a timeline rather than adding to one.
    /// Play leaves the games in <paramref name="writtenOut"/> undisrupted.
    /// </summary>
    private static PlaySettings ReadPlay(
        ScenarioFile file, double disruptedShare, IReadOnlySet<string> writtenOut, string scenario, string path,
        IReadOnlyList<League> leagues, IReadOnlyList<ScenarioVenue>? venues, ScenarioTeamList? teams)
    {
        ScenarioFileException Problem(string problem) => new(scenario, path, $"play {problem}");

        if (file.Timeline is not null)
            throw Problem("is on, so the scenario can't have a timeline as well; use one or the other");
        if (file.Fill?.Group is not { } group || venues is null || teams is null)
            throw Problem("needs a fill: new games go to venues from the fill's group");
        return new PlaySettings(
            leagues, venues.Where(venue => venue.Groups.Contains(group)).ToList(), new ScenarioGameMaker(leagues, teams), disruptedShare, writtenOut);
    }
}
