using ScoreMap.Server.GameFeed;

namespace ScoreMap.Server.Scenarios;

public static partial class ScenarioReader
{
    /// <summary>
    /// Reads a scenario's timeline and checks it against its games: every change names one of them,
    /// changes are in order within the timeline's length, and no game goes back from Final or has a
    /// score that goes down (ADR-0009).
    /// </summary>
    private static ScenarioTimeline ReadTimeline(TimelineEntry entry, IReadOnlyList<ScenarioGame> games, string scenario, string path)
    {
        if (!RelativeTime.TryParse(entry.Length, out var length) || length <= TimeSpan.Zero)
            throw new ScenarioFileException(scenario, path,
                $"the timeline has length \"{entry.Length}\", which isn't a time after the scenario's start such as \"5m\"; "
                + "the scenario starts again after this long");

        // Each game as the changes so far leave it, to check each change against.
        var current = games.ToDictionary(game => game.Id);
        var changes = new List<ScenarioChange>();
        var previousAt = (Time: TimeSpan.Zero, Text: "0");
        foreach (var (change, i) in (entry.Changes ?? []).Select((change, i) => (change, i)))
        {
            try
            {
                var read = ReadChange(change, current, length);
                if (read.At < previousAt.Time)
                    throw new InvalidDataException(
                        $"is at {change!.At}, out of order: it comes after a change at {previousAt.Text}; list changes in time order");
                previousAt = (read.At, change!.At!);
                current[read.GameId] = read.ApplyTo(current[read.GameId]);
                changes.Add(read);
            }
            catch (InvalidDataException e)
            {
                throw new ScenarioFileException(scenario, path, $"timeline change {i + 1} {e.Message}");
            }
        }
        return new ScenarioTimeline(length, changes);
    }

    private static ScenarioChange ReadChange(ChangeEntry? entry, Dictionary<string, ScenarioGame> games, TimeSpan length)
    {
        if (entry is null)
            throw new InvalidDataException("is empty");
        if (!RelativeTime.TryParse(entry.At, out var at))
            throw new InvalidDataException(
                $"has at \"{entry.At}\", which isn't a time relative to the scenario's start such as \"30s\" or \"1m30s\"");
        if (at < TimeSpan.Zero)
            throw new InvalidDataException($"is at {entry.At}, before the scenario starts");
        if (at >= length)
            throw new InvalidDataException($"is at {entry.At}, at or after the end of the timeline");
        if (string.IsNullOrWhiteSpace(entry.Game))
            throw new InvalidDataException("has no game; name one by its id");
        if (!games.TryGetValue(entry.Game, out var game))
            throw new InvalidDataException(
                $"has unknown game \"{entry.Game}\"; the scenario's games are {string.Join(", ", games.Keys)}");

        var change = new ScenarioChange(
            at, entry.Game,
            HomeScore: entry.Score?.Home,
            AwayScore: entry.Score?.Away,
            Status: entry.Status is null ? null : ReadStatus(entry.Status),
            Period: entry.Period,
            Clock: entry.Clock,
            Phase: entry.Phase is null ? null : ReadPhase(entry.Phase));

        if (game.Status == ProviderStatus.Final && change.Status is { } status && status != ProviderStatus.Final)
            throw new InvalidDataException(
                $"makes \"{game.Id}\" {entry.Status} when it is already Final; a Final game can't go back");
        if (change.HomeScore < game.Home.Score || change.AwayScore < game.Away.Score)
            throw new InvalidDataException(
                $"makes a score of \"{game.Id}\" go down, from {game.Home.Score}-{game.Away.Score}; scores only go up");
        return change;
    }

    private sealed record TimelineEntry(string? Length, List<ChangeEntry?>? Changes);

    private sealed record ChangeEntry(
        string? At, string? Game, ScoreEntry? Score, string? Status, int? Period, string? Clock, string? Phase);

    private sealed record ScoreEntry(int? Home, int? Away);
}
