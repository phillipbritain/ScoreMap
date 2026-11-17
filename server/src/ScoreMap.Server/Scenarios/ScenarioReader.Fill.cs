using ScoreMap.Server.GameFeed;
using ScoreMap.Server.Games;

namespace ScoreMap.Server.Scenarios;

public static partial class ScenarioReader
{
    // The statuses a mix shares filled games out between. Disrupted games aren't shown (ADR-0021), so none are filled.
    private static readonly GameStatus[] MixStatuses = [GameStatus.Upcoming, GameStatus.Live, GameStatus.Final];

    /// <summary>
    /// Expands a <c>fill</c> (ADR-0009): <c>count</c> games, each at a different venue from the named
    /// group of the venue list, in a league that plays there (ADR-0028), between its home team there and
    /// another, from the team list, that no other game (filled, or in <paramref name="writtenOutGames"/>) has, in statuses shared out by the <c>mix</c>
    /// (all Live without one), in leagues picked by its <c>leagues</c> shares (any league without them).
    /// The same scenario file gives the same games each time, since every
    /// choice is seeded by the scenario's name. Filled games are numbered <c>&lt;scenario&gt;-fill-&lt;n&gt;</c>.
    /// </summary>
    private static IReadOnlyList<ScenarioGame> ReadFill(
        FillEntry entry, IReadOnlyList<ScenarioGame> writtenOutGames, string scenario, string path, Lists lists)
    {
        var (leagues, venues, teams) = lists;
        ScenarioFileException Problem(string problem) => new(scenario, path, $"fill {problem}");

        if (venues is null)
            throw Problem("needs the venue list, but there is no venue list to fill from");
        if (teams is null)
            throw Problem("needs the team list, but there is no team list to fill from");
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
        IReadOnlyDictionary<string, double>? leagueShares;
        try
        {
            mix = entry.Mix is null ? StatusMix.AllLive : ReadMix(entry.Mix);
            leagueShares = ReadLeagueShares(entry.Leagues, leagues);
        }
        catch (InvalidDataException e)
        {
            throw Problem(e.Message);
        }

        var random = new Random(Scenario.StableSeed(scenario));
        var maker = new ScenarioGameMaker(leagues, teams, leagueShares);
        random.Shuffle(inGroup);
        var statuses = mix.Split(entry.Count, random);
        var filled = new List<ScenarioGame>();
        // Each venue in turn, skipping one where no league can play just now (its home teams taken).
        foreach (var venue in inGroup)
        {
            if (filled.Count == entry.Count)
                break;
            var playing = writtenOutGames.Concat(filled).Where(game => game.Contest is ProviderSides)
                .SelectMany(game => PlayingTeam.In(game.LeagueKey, game.Sides.Home, game.Sides.Away));
            try
            {
                filled.Add(maker.Make($"{scenario}-fill-{filled.Count + 1}", venue, statuses[filled.Count], playing, random));
            }
            catch (NotEnoughTeamsException)
            {
            }
        }
        if (filled.Count < entry.Count)
        {
            var beside = writtenOutGames.Count > 0 ? $" beside the {writtenOutGames.Count} written out" : "";
            throw Problem($"asks for {entry.Count} games from \"{entry.Group}\", but its venues have leagues with teams free for only {filled.Count} of them{beside}; "
                + "each filled game is at a different venue, in a league that plays there with its home team free");
        }
        return filled;
    }

    private static StatusMix ReadMix(Dictionary<string, double> entry)
    {
        var shares = new Dictionary<GameStatus, double>();
        foreach (var (name, share) in entry)
        {
            if (int.TryParse(name, out _) || !Enum.TryParse<GameStatus>(name, ignoreCase: true, out var status)
                || !MixStatuses.Contains(status))
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

    /// <summary>
    /// The fill's league shares (<c>"leagues"</c>, by league name or key) as weights by league key:
    /// <c>{ "NCAA Football": 1, "NFL": 2 }</c> makes about two NFL games for each college one, and none
    /// in leagues left out. Null without them, when every league is as likely.
    /// </summary>
    private static Dictionary<string, double>? ReadLeagueShares(Dictionary<string, double>? entry, IReadOnlyList<League> leagues)
    {
        if (entry is null)
            return null;
        var shares = new Dictionary<string, double>();
        foreach (var (name, share) in entry)
        {
            var league = leagues.FirstOrDefault(l => string.Equals(l.Name, name, StringComparison.OrdinalIgnoreCase) || l.Key == name)
                ?? throw new InvalidDataException(
                    $"has unknown league \"{name}\"; the configured leagues are {string.Join(", ", leagues.Select(l => l.Name))}");
            if (share < 0)
                throw new InvalidDataException($"gives {name} share {share}; shares can't be negative");
            shares[league.Key] = share;
        }
        if (shares.Values.Sum() <= 0)
            throw new InvalidDataException("has league shares that give no games to any league");
        return shares;
    }

    private sealed record FillEntry(int Count, string? Group, Dictionary<string, double>? Mix, Dictionary<string, double>? Leagues);
}
