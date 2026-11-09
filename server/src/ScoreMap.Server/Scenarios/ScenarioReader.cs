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
    /// a <c>fill</c> takes its venues from it and its teams from <paramref name="teams"/>, the team list.
    /// </summary>
    public static Scenario Read(
        string folder, string name, IReadOnlyList<League> leagues, IReadOnlyList<ScenarioVenue>? venues = null, ScenarioTeamList? teams = null)
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

        var lists = new Lists(leagues, venues, teams);
        var ids = new HashSet<string>();
        var games = (file.Games ?? []).Select((entry, i) =>
        {
            try
            {
                var game = ReadGame(entry, i, name, lists);
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
        var plays = ReadPlays(file, name, path);
        if (file.Fill is not null)
        {
            foreach (var game in ReadFill(file.Fill, games.ToList(), name, path, lists))
            {
                if (!ids.Add(game.Id))
                    throw new ScenarioFileException(name, path,
                        $"a written-out game has the id \"{game.Id}\", which fill gives to one of its games; pick another");
                games.Add(game);
            }
        }
        var timeline = file.Timeline is null ? null : ReadTimeline(file.Timeline, games, leagues, name, path);
        var play = plays ? ReadPlay(file, name, path, lists) : null;
        return new Scenario(name, games, timeline, play, ReadSlowStart(file.SlowStart, name, path));
    }

    /// <summary>
    /// How long the server holds back each browser's first games (<c>"slowStart"</c>, such as <c>"12s"</c>),
    /// in real time; none if left out.
    /// </summary>
    private static TimeSpan ReadSlowStart(string? slowStart, string scenario, string path)
    {
        if (slowStart is null)
            return TimeSpan.Zero;
        if (!RelativeTime.TryParse(slowStart, out var wait) || wait < TimeSpan.Zero)
            throw new ScenarioFileException(scenario, path,
                $"slowStart is \"{slowStart}\"; it's how long each browser waits for its first games, such as \"12s\"");
        return wait;
    }

    /// <summary>Reads one game written out in full; throws <see cref="InvalidDataException"/> saying what's wrong with it.</summary>
    private static ScenarioGame ReadGame(
        GameEntry? entry, int index, string scenario, Lists lists)
    {
        var (leagues, venues, _) = lists;
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
        var id = entry.Id ?? $"{scenario}-{index + 1}";
        ProviderContest contest = league.Sport switch
        {
            Sport.Racing or Sport.Golf => ReadField(entry),
            Sport.Mma => ReadBouts(entry, id, status),
            Sport.Football or Sport.Basketball or Sport.Baseball or Sport.Hockey
                or Sport.Soccer or Sport.Cricket or Sport.Rugby or Sport.Tennis =>
                    new ProviderSides(ReadTeam(entry.Home, "home"), ReadTeam(entry.Away, "away")),
            _ => throw new InvalidDataException($"has unsupported sport {league.Sport}"),
        };
        var venue = ReadVenue(entry.Venue, venues);
        var (sets, ending) = ReadTennis(entry.Sets, entry.EarlyEnding, status, league.Sport == Sport.Tennis);

        return new ScenarioGame(
            Id: id,
            LeagueKey: league.Key,
            StartsIn: startsIn,
            Contest: contest,
            Venue: venue,
            Status: status,
            Clock: entry.Clock,
            Period: entry.Period,
            Phase: phase)
        {
            Sets = sets ?? [],
            EarlyEnding = ending,
            Situation = ReadSituation(entry.Situation),
            Note = entry.Note,
        };
    }

    /// <summary>
    /// A race's or golf tournament's field: its entrants in order, the leader first (none before the feed
    /// would list them), in place of a home and an away team. A golfer has their score to par and the holes
    /// they've played of the round (<c>thru</c>), and golfers level on score share a position.
    /// </summary>
    private static ProviderField ReadField(GameEntry entry)
    {
        if (entry.Home is not null || entry.Away is not null)
            throw new InvalidDataException("is in a league whose games are among a field, so it has a field, not a home and an away team");
        if (entry.Field is null)
            throw new InvalidDataException("has no field; give it one, empty before the game starts");
        return ProviderField.TiedByScore(entry.Field.Select((entrant, i) =>
            entrant is null || string.IsNullOrWhiteSpace(entrant.Name) || string.IsNullOrWhiteSpace(entrant.ShortName)
                ? throw new InvalidDataException($"has entrant {i + 1} with no name or short name")
                : new ProviderEntrant(i + 1, entrant.Name, entrant.ShortName, entrant.Flag, entrant.Score, entrant.Thru)));
    }

    /// <summary>
    /// A fight card's bouts, the main event first, in place of a home and an away team. Each bout has its two
    /// sides, its weight class, its scheduled rounds (3 unless written), its status, and once started its round
    /// and the time into it; once over, how it was won and by whom (a side's <c>winner</c>). Its id is the
    /// game's with its place on the card (<c>&lt;game&gt;-bout-1</c> for the main event). The game's status
    /// must be what its bouts make it (see <see cref="ProviderBouts.Status"/>).
    /// </summary>
    private static ProviderBouts ReadBouts(GameEntry entry, string id, ProviderStatus status)
    {
        if (entry.Home is not null || entry.Away is not null)
            throw new InvalidDataException("is in a league of fight cards, so it has bouts, not a home and an away team");
        if (entry.Bouts is not { Count: > 0 })
            throw new InvalidDataException("has no bouts; a fight card needs at least its main event");
        var card = new ProviderBouts(entry.Bouts.Select((bout, i) =>
        {
            if (bout is null)
                throw new InvalidDataException($"has bout {i + 1} empty");
            var method = bout.Method switch
            {
                null => (BoutMethod?)null,
                var written when !int.TryParse(written, out _) && Enum.TryParse<BoutMethod>(written, ignoreCase: true, out var read) => read,
                var written => throw new InvalidDataException(
                    $"has bout {i + 1} with unknown method \"{written}\"; use one of {string.Join(", ", Enum.GetNames<BoutMethod>())}"),
            };
            return new ProviderBout($"{id}-bout-{i + 1}", ReadBoutSide(bout.First, i, "first"), ReadBoutSide(bout.Second, i, "second"),
                bout.WeightClass, bout.Rounds ?? 3, ReadStatus(bout.Status), bout.Round, bout.Clock, method);
        }).ToList());
        if (card.Status(status) != status)
            throw new InvalidDataException(
                $"has status {Statuses.First(s => s.Value == status).Key}, but its bouts make it {Statuses.First(s => s.Value == card.Status(status)).Key}");
        return card;
    }

    private static ProviderBoutSide ReadBoutSide(BoutSideEntry? side, int bout, string which) =>
        side is null || string.IsNullOrWhiteSpace(side.Name) || string.IsNullOrWhiteSpace(side.ShortName)
            ? throw new InvalidDataException($"has bout {bout + 1} with no {which} side, or one with no name or short name")
            : new ProviderBoutSide(side.Name, side.ShortName, side.Flag, side.Record, side.Winner);

    /// <summary>What a game that isn't between two sides is, for a message: "among a field" or "a fight card".</summary>
    private static string ContestName(ProviderContest contest) => contest is ProviderBouts ? "a fight card" : "among a field";

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
        var innings = team.Innings is { } written
            ? new ProviderInnings(written.Wickets, written.Overs, written.OverLimit, written.Target)
            : null;
        return new ProviderTeam(team.Abbreviation, team.Name, team.Logo, team.Score, Innings: innings);
    }

    /// <summary>Where play stands, as written: in baseball the outs and which bases have runners on.</summary>
    private static ProviderSituation? ReadSituation(SituationEntry? situation) =>
        situation is null
            ? null
            : new ProviderSituation(null, Outs: situation.Outs, OnFirst: situation.OnFirst, OnSecond: situation.OnSecond, OnThird: situation.OnThird);

    // The file's own shape, kept apart from the model so the format can grow.
    private sealed record ScenarioFile(
        List<GameEntry?>? Games, TimelineEntry? Timeline, FillEntry? Fill, JsonElement? Play, string? SlowStart);

    /// <summary>
    /// A game written out in full: between a home and an away team, for a race or golf tournament among a <c>field</c>, or for a
    /// fight card its <c>bouts</c>, with the race's or the card's name as its <c>note</c>.
    /// </summary>
    private sealed record GameEntry(
        string? Id, string? League, TeamEntry? Home, TeamEntry? Away, VenueEntry? Venue,
        string? StartsIn, string? Status, string? Clock, int? Period, string? Phase, SituationEntry? Situation,
        List<EntrantEntry?>? Field, string? Note, List<BoutEntry?>? Bouts, List<SetEntry?>? Sets = null, EarlyEndingEntry? EarlyEnding = null);

    private sealed record SetEntry(int? Home, int? Away, int? HomeTiebreak, int? AwayTiebreak, bool? HomeWon);

    /// <summary>Reads tennis facts without starting play or inventing a set for another status.</summary>
    private static (IReadOnlyList<ProviderSet>? Sets, ProviderEarlyEnding? Ending) ReadTennis(
        List<SetEntry?>? sets, EarlyEndingEntry? ending, ProviderStatus status, bool tennis)
    {
        if ((sets is not null || ending is not null) && !tennis)
            throw new InvalidDataException("has sets or earlyEnding outside tennis");
        if (ending is not null && status != ProviderStatus.Final)
            throw new InvalidDataException("has earlyEnding but isn't Final");
        var read = sets?.Select((set, i) =>
        {
            if (set?.Home is not { } home || set.Away is not { } away
                || home < 0 || away < 0 || set.HomeTiebreak < 0 || set.AwayTiebreak < 0)
                throw new InvalidDataException($"has set {i + 1} without nonnegative home and away games or tiebreak points");
            return new ProviderSet(home, away, set.HomeTiebreak, set.AwayTiebreak, set.HomeWon);
        }).ToList();
        return (read, ReadEarlyEnding(ending));
    }

    private sealed record EarlyEndingEntry(string? Reason, string? Winner);

    private static ProviderEarlyEnding? ReadEarlyEnding(EarlyEndingEntry? ending)
    {
        if (ending is null)
            return null;
        if (ending.Reason is null || int.TryParse(ending.Reason, out _)
            || !Enum.TryParse<EarlyEndingReason>(ending.Reason, ignoreCase: true, out var reason)
            || !Enum.IsDefined(reason))
            throw new InvalidDataException("has unknown earlyEnding reason; use retired or walkover");
        return new ProviderEarlyEnding(reason, ending.Winner);
    }

    /// <summary>One bout of a fight card (see <see cref="ReadBouts"/>).</summary>
    private sealed record BoutEntry(
        BoutSideEntry? First, BoutSideEntry? Second, string? WeightClass, int? Rounds, string? Status, int? Round, string? Clock,
        string? Method);

    /// <summary>One of a bout's two sides: their name, short name ("J. Jones"), country's flag, record ("27-1-0") and whether they won.</summary>
    private sealed record BoutSideEntry(string? Name, string? ShortName, string? Flag, string? Record, bool Winner = false);

    /// <summary>
    /// One of a field, in order: their name, short name ("K. Larson") and country's flag; in golf, their
    /// <c>score</c> to par (-12; 0 is level) and the holes they've played of the round (<c>thru</c>).
    /// </summary>
    private sealed record EntrantEntry(string? Name, string? ShortName, string? Flag, int? Score, int? Thru);

    /// <summary>A team; in cricket, with its <c>innings</c> beyond its runs (see <see cref="ProviderInnings"/>).</summary>
    private sealed record TeamEntry(string? Name, string? Abbreviation, string? Logo, int? Score, InningsEntry? Innings);

    private sealed record InningsEntry(int? Wickets, string? Overs, int? OverLimit, int? Target);

    private sealed record SituationEntry(int? Outs, bool OnFirst, bool OnSecond, bool OnThird);

    private sealed record VenueEntry(string? Name, string? City, string? Region, string? Country, bool NotInVenueList = false);

    /// <summary>What a scenario file is read against: the configured leagues, the venue list and the team list.</summary>
    private sealed record Lists(IReadOnlyList<League> Leagues, IReadOnlyList<ScenarioVenue>? Venues, ScenarioTeamList? Teams);
}

/// <summary>A scenario file that can't be used, and why.</summary>
public sealed class ScenarioFileException(string scenario, string path, string problem)
    : Exception($"Scenario \"{scenario}\" can't be used ({path}): {problem}");
