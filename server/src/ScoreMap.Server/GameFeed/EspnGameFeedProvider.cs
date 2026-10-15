using System.Net.Http.Json;
using System.Text.RegularExpressions;

namespace ScoreMap.Server.GameFeed;

/// <summary>
/// Reads ESPN's unofficial scoreboard endpoints (ADR-0001) and turns them into
/// provider-neutral games. All knowledge of ESPN's response shape stays in this file.
/// The <see cref="HttpClient"/> base address is the sports root, e.g.
/// <c>https://site.api.espn.com/apis/site/v2/sports/</c>; league keys are <c>{sport}/{league}</c>.
/// </summary>
public sealed partial class EspnGameFeedProvider(HttpClient http, TimeProvider clock) : IGameFeedProvider
{
    private readonly System.Collections.Concurrent.ConcurrentDictionary<string, ProviderCity?> _homeCities = new();

    // Each started game's last score, by league and game, with the score it was looked up at: the
    // scoreboard doesn't carry it, so it's asked for again only when the score has changed.
    private readonly System.Collections.Concurrent.ConcurrentDictionary<string, (string Score, ProviderScoringPlay? Play)> _lastScores = new();

    public async Task<IReadOnlyList<ProviderGame>> FetchScoreboardAsync(string leagueKey, CancellationToken cancellationToken)
    {
        // A league key may carry its own scoreboard options after a '?', e.g. "basketball/mens-college-basketball?groups=50".
        var (league, options) = leagueKey.Split('?', 2) switch
        {
            [var path, var query] => (path, query + "&"),
            _ => (leagueKey, ""),
        };
        // ESPN only answers single days (a date range is refused), so each day is its own request.
        // Without a limit ESPN can leave games off busy days such as a college football Saturday.
        var scoreboards = await Task.WhenAll(EspnDays(clock.GetUtcNow()).Select(day =>
            http.GetFromJsonAsync<Scoreboard>($"{league}/scoreboard?{options}dates={day:yyyyMMdd}&limit=500", cancellationToken)));

        var games = new List<ProviderGame>();
        // Today's scoreboard comes first, so a game listed on more than one day is reported as today has it.
        foreach (var e in scoreboards.SelectMany(s => s?.Events ?? []).DistinctBy(e => e.Id))
        {
            if (ToGame(e, leagueKey) is not { } game)
                continue;
            // The pin falls back to the home team's city only when there's no venue, so only then is it worth asking.
            if (game.Venue is null && HomeTeamId(e) is { } teamId)
                game = game with { Home = game.Home with { HomeCity = await HomeCityAsync(leagueKey, teamId, cancellationToken) } };
            games.Add(game);
        }
        ForgetLastScoresNoLongerReported(leagueKey, games);
        return await Task.WhenAll(games.Select(game => WithLastScoreAsync(game, league, cancellationToken)));
    }

    /// <summary>
    /// The game with its last score. Soccer's comes with the scoreboard, from its goals, and cricket has
    /// none (runs come off almost every ball). Every other sport's is only in the game's summary, which is
    /// large, so it's asked for only when the score has changed since it was last asked for. If the summary
    /// hasn't caught up with the score yet, it's asked for again next time. A failed request leaves the
    /// last score as it was, to be tried again next time.
    /// </summary>
    private async Task<ProviderGame> WithLastScoreAsync(ProviderGame game, string league, CancellationToken cancellationToken)
    {
        if (game.LastScore is not null || league.StartsWith("soccer/", StringComparison.Ordinal)
            || league.StartsWith("cricket/", StringComparison.Ordinal)
            || game.Home.Score is not { } home || game.Away.Score is not { } away || home + away == 0)
            return game;

        var key = $"{game.LeagueKey}/{game.Id}";
        var score = $"{home}-{away}";
        var known = _lastScores.GetValueOrDefault(key);
        if (known.Score == score)
            return game with { LastScore = known.Play };
        try
        {
            var summary = await http.GetFromJsonAsync<Summary>($"{league}/summary?event={game.Id}", cancellationToken);
            // Football's summary lists its scoring plays; the other sports' only list every play.
            var plays = summary?.ScoringPlays ?? summary?.Plays?.Where(p => p.ScoringPlay == true).ToList() ?? [];
            if (plays.LastOrDefault() is not { } last)
                return game with { LastScore = known.Play };
            var play = ToScoringPlay(last, summary!.Header?.Competitions?.FirstOrDefault()?.Competitors ?? []) ?? known.Play;
            var caughtUp = last.HomeScore == home && last.AwayScore == away;
            _lastScores[key] = (caughtUp ? score : known.Score ?? "", play);
            return game with { LastScore = play };
        }
        catch (Exception ex) when (ex is HttpRequestException or System.Text.Json.JsonException
            || (ex is TaskCanceledException && !cancellationToken.IsCancellationRequested))
        {
            return game with { LastScore = known.Play };
        }
    }

    private void ForgetLastScoresNoLongerReported(string leagueKey, IReadOnlyList<ProviderGame> games)
    {
        var reported = games.Select(game => $"{leagueKey}/{game.Id}").ToHashSet();
        foreach (var key in _lastScores.Keys)
            if (key.StartsWith($"{leagueKey}/", StringComparison.Ordinal) && !reported.Contains(key))
                _lastScores.TryRemove(key, out _);
    }

    /// <summary>A play from a game's summary as a score, naming its team by abbreviation; null if the team isn't in the game.</summary>
    private static ProviderScoringPlay? ToScoringPlay(Play play, List<Competitor> competitors)
    {
        var team = play.Team?.Abbreviation
            ?? competitors.FirstOrDefault(c => c.Id is not null && c.Id == play.Team?.Id)?.Team?.Abbreviation;
        if (team is null || string.IsNullOrWhiteSpace(play.Text))
            return null;
        var phase = play.Period?.Type switch
        {
            "Top" => ProviderPeriodPhase.InningTop,
            "Bottom" => ProviderPeriodPhase.InningBottom,
            _ => ProviderPeriodPhase.Playing,
        };
        return new ProviderScoringPlay(team, play.Text.Trim(), play.Period?.Number, play.Clock?.DisplayValue, phase);
    }

    /// <summary>
    /// The scoreboard doesn't say where a team is based, so ask ESPN's team endpoint, once per team
    /// (answers are kept for the life of the provider). Prefers the franchise venue's address; teams
    /// without one (college, soccer) fall back to ESPN's "location", e.g. "Duke", which is a place
    /// name but not always a city. A failed request is not kept, so it is tried again next time.
    /// </summary>
    private async Task<ProviderCity?> HomeCityAsync(string leagueKey, string teamId, CancellationToken cancellationToken)
    {
        var key = $"{leagueKey}/teams/{teamId}";
        if (_homeCities.TryGetValue(key, out var known))
            return known;
        try
        {
            var team = (await http.GetFromJsonAsync<TeamResponse>(key, cancellationToken))?.Team;
            var address = team?.Franchise?.Venue?.Address;
            var city = !string.IsNullOrWhiteSpace(address?.City)
                ? new ProviderCity(address.City, address.State, address.Country)
                : !string.IsNullOrWhiteSpace(team?.Location) ? new ProviderCity(team.Location, null, null) : null;
            return _homeCities[key] = city;
        }
        catch (Exception ex) when (ex is HttpRequestException or System.Text.Json.JsonException
            || (ex is TaskCanceledException && !cancellationToken.IsCancellationRequested))
        {
            return null;
        }
    }

    private static string? HomeTeamId(Event e) =>
        e.Competitions?.FirstOrDefault()?.Competitors?.FirstOrDefault(c => c.HomeAway == "home")?.Team?.Id;

    /// <summary>
    /// The scoreboard days worth asking for, today's first. ESPN's scoreboard days are US Eastern calendar
    /// days, so a game that started yesterday evening (still Live, recently Final, or Disrupted) is only on
    /// yesterday's. Tomorrow's is only asked for within <see cref="TomorrowLookahead"/> of midnight, when
    /// its first games are near enough to be Upcoming.
    /// </summary>
    private static IEnumerable<DateTime> EspnDays(DateTimeOffset now)
    {
        var eastern = TimeZoneInfo.ConvertTime(now, TimeZoneInfo.FindSystemTimeZoneById("America/New_York")).DateTime;
        var today = eastern.Date;
        yield return today;
        yield return today.AddDays(-1);
        if (today.AddDays(1) - eastern <= TomorrowLookahead)
            yield return today.AddDays(1);
    }

    /// <summary>Matches the board's Upcoming window: a game gets its pin this long before its start.</summary>
    private static readonly TimeSpan TomorrowLookahead = TimeSpan.FromHours(3);

    private static ProviderGame? ToGame(Event e, string leagueKey)
    {
        var competition = e.Competitions?.FirstOrDefault();
        var home = competition?.Competitors?.FirstOrDefault(c => c.HomeAway == "home");
        var away = competition?.Competitors?.FirstOrDefault(c => c.HomeAway == "away");
        if (e.Id is null || home?.Team is null || away?.Team is null)
            return null;

        var status = e.Status ?? competition!.Status;
        var started = status?.Type?.State is "in" or "post";
        var teams = competition!.Competitors!
            .Where(c => c.Id is not null && c.Team?.Abbreviation is not null)
            .DistinctBy(c => c.Id)
            .ToDictionary(c => c.Id!, c => c.Team!.Abbreviation!);
        var keyEvents = started ? ToKeyEvents(competition.Details, teams) : [];

        return new ProviderGame(
            e.Id,
            leagueKey,
            e.Date ?? competition!.Date ?? DateTimeOffset.MinValue,
            ToTeam(home, started, leagueKey),
            ToTeam(away, started, leagueKey),
            ToStatus(status?.Type),
            started ? status?.DisplayClock : null,
            started ? status?.Period : null,
            ToVenue(competition!.Venue),
            ToBroadcasters(competition),
            status?.Type?.State == "in" ? ToPhase(status.Type) : ProviderPeriodPhase.Playing)
        {
            Note = ToNote(competition.Notes),
            Attendance = competition.Attendance > 0 ? competition.Attendance : null,
            Odds = ToOdds(competition.Odds?.FirstOrDefault()),
            Situation = status?.Type?.State == "in" ? ToSituation(competition.Situation, teams) : null,
            KeyEvents = keyEvents,
            LastScore = keyEvents.LastOrDefault(k => k.Kind is KeyEventKind.Goal or KeyEventKind.PenaltyGoal or KeyEventKind.OwnGoal) is { } goal
                ? new ProviderScoringPlay(goal.Team, GoalText(goal), null, goal.Clock)
                : null,
        };
    }

    /// <summary>The headlines of the competition's notes, usually just one; null when it has none.</summary>
    private static string? ToNote(List<Note>? notes)
    {
        var headlines = (notes ?? []).Select(n => NullIfBlank(n.Headline)).OfType<string>().Distinct().ToList();
        return headlines.Count > 0 ? string.Join(" · ", headlines) : null;
    }

    private static ProviderOdds? ToOdds(Odds? odds) =>
        odds is null || (string.IsNullOrWhiteSpace(odds.Details) && odds.OverUnder is null)
            ? null
            : new ProviderOdds(NullIfBlank(odds.Details), odds.OverUnder, odds.Provider?.Name);

    /// <summary>
    /// Where play stands, from the scoreboard's situation, which ESPN gives only while a game is under way
    /// (and in cricket gives empty). Null when it says nothing.
    /// </summary>
    private static ProviderSituation? ToSituation(Situation? situation, Dictionary<string, string> teams)
    {
        if (situation is null)
            return null;
        var found = new ProviderSituation(
            NullIfBlank(situation.LastPlay?.Text),
            NullIfBlank(situation.DownDistanceText),
            situation.Possession is { } id ? teams.GetValueOrDefault(id) : null,
            situation.Balls,
            situation.Strikes,
            situation.Outs,
            situation.OnFirst == true,
            situation.OnSecond == true,
            situation.OnThird == true);
        return found == new ProviderSituation(null) ? null : found;
    }

    private static string? NullIfBlank(string? text) => string.IsNullOrWhiteSpace(text) ? null : text.Trim();

    /// <summary>
    /// Soccer's goals and cards, from the scoreboard's details. Shootout kicks are left out: they settle
    /// the game but aren't goals in its score.
    /// </summary>
    private static IReadOnlyList<ProviderKeyEvent> ToKeyEvents(List<Detail>? details, Dictionary<string, string> teams)
    {
        var events = new List<ProviderKeyEvent>();
        foreach (var detail in details ?? [])
        {
            if (detail.Shootout == true || detail.Team?.Id is not { } id || !teams.TryGetValue(id, out var team))
                continue;
            KeyEventKind? kind = detail switch
            {
                { ScoringPlay: true, OwnGoal: true } => KeyEventKind.OwnGoal,
                { ScoringPlay: true, PenaltyKick: true } => KeyEventKind.PenaltyGoal,
                { ScoringPlay: true } => KeyEventKind.Goal,
                { RedCard: true } => KeyEventKind.RedCard,
                { YellowCard: true } => KeyEventKind.YellowCard,
                _ => null,
            };
            if (kind is not null)
                events.Add(new ProviderKeyEvent(kind.Value, team,
                    NullIfBlank(detail.AthletesInvolved?.FirstOrDefault()?.DisplayName), detail.Clock?.DisplayValue));
        }
        return events;
    }

    private static string GoalText(ProviderKeyEvent goal)
    {
        var what = goal.Kind switch
        {
            KeyEventKind.PenaltyGoal => "Penalty",
            KeyEventKind.OwnGoal => "Own goal",
            _ => "Goal",
        };
        return goal.Player is { } player ? $"{what}: {player}" : what;
    }

    private static ProviderTeam ToTeam(Competitor competitor, bool started, string leagueKey)
    {
        var team = new ProviderTeam(competitor.Team!.Abbreviation ?? "",
            competitor.Team.DisplayName ?? competitor.Team.Abbreviation ?? "",
            competitor.Team.Logo,
            started && int.TryParse(competitor.Score, out var score) ? score : null,
            Rank: competitor.CuratedRank?.Current is >= 1 and <= TopRanked ? competitor.CuratedRank.Current : null,
            Record: NullIfBlank(competitor.Records?.FirstOrDefault(r => r.Type == "total")?.Summary));
        return started && leagueKey.StartsWith("cricket/", StringComparison.Ordinal) ? WithInnings(team, competitor.Score) : team;
    }

    /// <summary>
    /// Cricket's score is text: runs, wickets unless all out, and for the side batting (or last to bat)
    /// the overs, the most it may face and the target it chases: "186/6", "127",
    /// "100/6 (13/20 ov, target 187)", or "204/8 (20 ov, target 211)" once its overs are done. A team
    /// yet to bat has no score.
    /// </summary>
    private static ProviderTeam WithInnings(ProviderTeam team, string? score)
    {
        if (CricketScore().Match(score ?? "") is not { Success: true } match)
            return team with { Score = null };
        int? Number(string group) => match.Groups[group].Success ? int.Parse(match.Groups[group].Value) : null;
        return team with
        {
            Score = Number("runs"),
            Innings = new ProviderInnings(
                Number("wickets"),
                match.Groups["overs"].Success ? match.Groups["overs"].Value : null,
                Number("limit"),
                Number("target")),
        };
    }

    /// <summary>
    /// The lowest place in a poll ESPN ranks a team at. It gives every other team a place too, 99, which
    /// means it's unranked.
    /// </summary>
    private const int TopRanked = 25;

    [GeneratedRegex(@"^(?<runs>\d+)(/(?<wickets>\d+))?( \((?<overs>\d+(\.\d)?)(/(?<limit>\d+))? ov(, target (?<target>\d+))?\))?$")]
    private static partial Regex CricketScore();

    private static ProviderStatus ToStatus(StatusType? type)
    {
        var name = type?.Name ?? "";
        if (name.Contains("POSTPONED")) return ProviderStatus.Postponed;
        if (name.Contains("CANCELED") || name.Contains("CANCELLED") || name.Contains("ABANDONED")) return ProviderStatus.Canceled;
        if (name.Contains("SUSPENDED")) return ProviderStatus.Suspended;
        if (name.Contains("DELAY")) return ProviderStatus.Delayed;
        return type?.State switch
        {
            "in" => ProviderStatus.InProgress,
            "post" => ProviderStatus.Final,
            _ => ProviderStatus.Scheduled,
        };
    }

    /// <summary>
    /// Baseball's half-inning is only given as text ("Top 7th", "Mid 7th", "Bot 7th", "End 7th"),
    /// so it is read first, as is cricket's innings break, which has no status name; other breaks come
    /// from the status name.
    /// </summary>
    private static ProviderPeriodPhase ToPhase(StatusType type)
    {
        if ($"{type.Description} {type.ShortDetail}".Contains("innings break", StringComparison.OrdinalIgnoreCase))
            return ProviderPeriodPhase.Break;

        if (InningDetail().Match(type.ShortDetail ?? "") is { Success: true } inning)
        {
            return inning.Groups[1].Value switch
            {
                "Top" => ProviderPeriodPhase.InningTop,
                "Mid" => ProviderPeriodPhase.InningMiddle,
                "Bot" => ProviderPeriodPhase.InningBottom,
                _ => ProviderPeriodPhase.InningEnd,
            };
        }

        var name = type.Name ?? "";
        if (name.Contains("SHOOTOUT")) return ProviderPeriodPhase.Shootout;
        if (name.Contains("HALFTIME") || name.Contains("END_PERIOD") || name.Contains("END_OF_")) return ProviderPeriodPhase.Break;
        return ProviderPeriodPhase.Playing;
    }

    [GeneratedRegex(@"^(Top|Mid|Bot|End) \d+(st|nd|rd|th)$")]
    private static partial Regex InningDetail();

    private static ProviderVenue? ToVenue(Venue? venue) =>
        venue is null ? null : new ProviderVenue(venue.FullName, venue.Address?.City, venue.Address?.State, venue.Address?.Country, venue.Id);

    private static IReadOnlyList<ProviderBroadcaster> ToBroadcasters(Competition competition)
    {
        var geo = (competition.GeoBroadcasts ?? [])
            .Where(b => b.Media?.ShortName is not null && !string.Equals(b.Type?.ShortName, "Radio", StringComparison.OrdinalIgnoreCase))
            .Select(b => new ProviderBroadcaster(b.Media!.ShortName!, b.Region?.ToUpperInvariant()));
        var plain = (competition.Broadcasts ?? [])
            .SelectMany(b => b.Names ?? [])
            .Select(name => new ProviderBroadcaster(name, null));
        var broadcasters = geo.Any() ? geo : plain;
        return broadcasters.Distinct().ToList();
    }

    // ESPN response shape (only the fields ScoreMap reads).
    private sealed record Scoreboard(List<Event>? Events);
    private sealed record Event(string? Id, DateTimeOffset? Date, List<Competition>? Competitions, Status? Status);
    private sealed record Competition(DateTimeOffset? Date, Venue? Venue, List<Competitor>? Competitors, Status? Status,
        List<Broadcast>? Broadcasts, List<GeoBroadcast>? GeoBroadcasts, int? Attendance, List<Odds>? Odds,
        Situation? Situation, List<Detail>? Details, List<Note>? Notes);
    private sealed record Note(string? Headline);
    private sealed record Competitor(string? Id, string? HomeAway, Team? Team, string? Score, List<TeamRecord>? Records,
        CuratedRank? CuratedRank);
    private sealed record TeamRecord(string? Type, string? Summary);
    private sealed record CuratedRank(int? Current);
    private sealed record Odds(string? Details, double? OverUnder, OddsProvider? Provider);
    private sealed record OddsProvider(string? Name);
    private sealed record Situation(LastPlay? LastPlay, string? DownDistanceText, string? Possession,
        int? Balls, int? Strikes, int? Outs, bool? OnFirst, bool? OnSecond, bool? OnThird);
    private sealed record LastPlay(string? Text);
    private sealed record Detail(Clock? Clock, TeamRef? Team, bool? ScoringPlay, bool? RedCard, bool? YellowCard,
        bool? PenaltyKick, bool? OwnGoal, bool? Shootout, List<Athlete>? AthletesInvolved);
    private sealed record Clock(string? DisplayValue);
    private sealed record TeamRef(string? Id, string? Abbreviation);
    private sealed record Athlete(string? DisplayName);
    private sealed record Summary(SummaryHeader? Header, List<Play>? ScoringPlays, List<Play>? Plays);
    private sealed record SummaryHeader(List<Competition>? Competitions);
    private sealed record Play(string? Text, bool? ScoringPlay, TeamRef? Team, PlayPeriod? Period, Clock? Clock,
        int? HomeScore, int? AwayScore);
    private sealed record PlayPeriod(int? Number, string? Type);
    private sealed record Team(string? Id, string? Abbreviation, string? DisplayName, string? Logo);
    private sealed record TeamResponse(TeamDetail? Team);
    private sealed record TeamDetail(string? Location, Franchise? Franchise);
    private sealed record Franchise(Venue? Venue);
    private sealed record Status(string? DisplayClock, int? Period, StatusType? Type);
    private sealed record StatusType(string? Name, string? State, bool? Completed, string? ShortDetail, string? Description);
    private sealed record Venue(string? Id, string? FullName, Address? Address);
    private sealed record Address(string? City, string? State, string? Country);
    private sealed record Broadcast(string? Market, List<string>? Names);
    private sealed record GeoBroadcast(GeoBroadcastType? Type, GeoMedia? Media, string? Region);
    private sealed record GeoBroadcastType(string? ShortName);
    private sealed record GeoMedia(string? ShortName);
}
