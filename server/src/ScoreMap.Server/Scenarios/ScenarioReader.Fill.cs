using ScoreMap.Server.Games;

namespace ScoreMap.Server.Scenarios;

public static partial class ScenarioReader
{
    // The statuses a mix shares filled games out between; Disrupted games have their own share.
    private static readonly GameStatus[] MixStatuses = [GameStatus.Upcoming, GameStatus.Live, GameStatus.Final];

    /// <summary>
    /// Expands a <c>fill</c> (ADR-0009): <c>count</c> games, each at a different venue from the named
    /// group of the venue list, with that venue's home team: <paramref name="disruptedShare"/> of them
    /// Disrupted (the scenario's <c>"disrupted"</c>), the rest in statuses shared out by the <c>mix</c>
    /// (all Live without one). The same scenario file gives the same games each time, since every
    /// choice is seeded by the scenario's name. Filled games are numbered <c>&lt;scenario&gt;-fill-&lt;n&gt;</c>.
    /// </summary>
    private static IReadOnlyList<ScenarioGame> ReadFill(
        FillEntry entry, double disruptedShare, string scenario, string path, IReadOnlyList<League> leagues, IReadOnlyList<ScenarioVenue>? venues)
    {
        ScenarioFileException Problem(string problem) => new(scenario, path, $"fill {problem}");

        if (venues is null)
            throw Problem("needs the venue list, but there is no venue list to fill from");
        if (entry.Count < 1)
            throw Problem($"has count {entry.Count}; ask for at least 1 game");
        if (string.IsNullOrWhiteSpace(entry.Group))
            throw Problem("has no group; name a group of venues such as \"worldwide\"");
        var inGroup = venues.Where(venue => venue.Groups.Contains(entry.Group)).ToArray();
        if (inGroup.Length == 0)
            throw Problem($"has unknown group \"{entry.Group}\"; the venue groups are "
                + string.Join(", ", venues.SelectMany(venue => venue.Groups).Distinct()));
        if (entry.Count > inGroup.Length)
            throw Problem($"asks for {entry.Count} games from \"{entry.Group}\", which has only {inGroup.Length} venues; "
                + "each filled game is at a different venue");
        StatusMix mix;
        try
        {
            mix = entry.Mix is null ? StatusMix.AllLive : ReadMix(entry.Mix);
        }
        catch (InvalidDataException e)
        {
            throw Problem(e.Message);
        }

        var random = new Random(Scenario.StableSeed(scenario));
        var maker = new ScenarioGameMaker(leagues, venues);
        random.Shuffle(inGroup);
        var statuses = mix.WithDisrupted(disruptedShare).Split(entry.Count, random);
        return inGroup.Take(entry.Count)
            .Select((venue, i) => maker.Make($"{scenario}-fill-{i + 1}", venue, statuses[i], random))
            .ToList();
    }

    private static StatusMix ReadMix(Dictionary<string, double> entry)
    {
        var shares = new Dictionary<GameStatus, double>();
        foreach (var (name, share) in entry)
        {
            if (string.Equals(name, nameof(GameStatus.Disrupted), StringComparison.OrdinalIgnoreCase))
                throw new InvalidDataException(
                    $"has a mix giving {name} a share; set the share of Disrupted games with \"disrupted\" beside \"play\" instead");
            if (int.TryParse(name, out _) || !Enum.TryParse<GameStatus>(name, ignoreCase: true, out var status))
                throw new InvalidDataException(
                    $"has a mix with unknown status \"{name}\"; use {string.Join(", ", MixStatuses.Select(status => status.ToString().ToLowerInvariant()))}");
            if (share < 0)
                throw new InvalidDataException($"has a mix giving {name} share {share}; shares can't be negative");
            shares[status] = share;
        }
        if (shares.Values.Sum() <= 0)
            throw new InvalidDataException("has a mix that gives no games to any status");
        return new StatusMix(shares);
    }

    private sealed record FillEntry(int Count, string? Group, Dictionary<string, double>? Mix);
}
