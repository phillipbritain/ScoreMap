using System.Net.Http.Json;
using System.Text.RegularExpressions;

namespace ScoreMap.Server.GameFeed;

/// <summary>
/// Reads ESPN's unofficial scoreboard endpoints (ADR-0001) and turns them into
/// provider-neutral games. All knowledge of ESPN's response shape stays in this file.
/// The <see cref="HttpClient"/> base address is the sports root, e.g.
/// <c>https://site.api.espn.com/apis/site/v2/sports/</c>; league keys are <c>{sport}/{league}</c>.
/// IndyCar's races, which ESPN gives no venue for anywhere, are placed from <c>indyCarTracks</c>, and one
/// missing from it is left out.
/// </summary>
public sealed partial class EspnGameFeedProvider(HttpClient http, TimeProvider clock, string? savedEventVenuesPath = null,
    TrackList? indyCarTracks = null)
    : IGameFeedProvider
{
    private const string IndyCar = "racing/irl";

    private readonly System.Collections.Concurrent.ConcurrentDictionary<string, ProviderCity?> _homeCities = new();

    // Each started game's last score, by league and game, with the score it was looked up at and how many
    // more times it may be asked for at that score: the scoreboard doesn't carry it, so it's asked for again
    // only when the score has changed.
    private readonly System.Collections.Concurrent.ConcurrentDictionary<string, (string Score, int TriesLeft, ProviderScoringPlay? Play)> _lastScores = new();

    // Each event's venue from the core API, by league and event, loaded from and saved to savedEventVenuesPath
    // (see EventVenueAsync), one lookup at a time.
    private readonly SemaphoreSlim _eventVenuesGate = new(1, 1);
    private Dictionary<string, ProviderVenue?>? _eventVenues;

    private static readonly System.Text.Json.JsonSerializerOptions SavedJson =
        new(System.Text.Json.JsonSerializerDefaults.Web) { WriteIndented = true };

    /// <summary>How many times a game's summary is asked for at one score before waiting for the score to change.</summary>
    private const int SummaryTries = 3;

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
            if (league.StartsWith("tennis/", StringComparison.Ordinal))
            {
                games.AddRange(ToMatches(e, leagueKey));
                continue;
            }
            var golf = league.StartsWith("golf/", StringComparison.Ordinal);
            if (golf || league.StartsWith("racing/", StringComparison.Ordinal))
            {
                if ((golf ? ToTournament(e, leagueKey) : ToFieldGame(e, leagueKey)) is not { } fieldGame)
                    continue;
                if (league == IndyCar)
                {
                    // ESPN has no IndyCar venue, on the scoreboard or in the core API's event, so a race is at its
                    // track in the track list, and one missing from it (logged there) is left out, having no pin.
                    if (indyCarTracks?.Find(fieldGame.Note) is { } track)
                        games.Add(fieldGame with { Venue = track });
                    continue;
                }
                games.Add(fieldGame.Venue is null
                    ? fieldGame with { Venue = await EventVenueAsync(league, fieldGame.Id, cancellationToken) }
                    : fieldGame);
                continue;
            }
            if (league.StartsWith("mma/", StringComparison.Ordinal))
            {
                if (ToFightCard(e, leagueKey) is { } fightCard)
                    games.Add(fightCard);
                continue;
            }
            if (ToGame(e, leagueKey) is not { } game)
                continue;
            // The pin falls back to the home team's city only when there's no venue, so only then is it worth asking.
            if (game.Venue is null && game.Contest is ProviderSides sides && HomeTeamId(e) is { } teamId)
            {
                var homeCity = await HomeCityAsync(leagueKey, teamId, cancellationToken);
                game = game with { Contest = sides with { Home = sides.Home with { HomeCity = homeCity } } };
            }
            games.Add(game);
        }
        ForgetLastScoresNoLongerReported(leagueKey, games);
        return await Task.WhenAll(games.Select(game => WithLastScoreAsync(game, league, cancellationToken)));
    }

    /// <summary>
    /// The game with its last score. Soccer's and rugby's come with the scoreboard, from their scoring, and cricket and
    /// tennis have none (runs come off almost every ball; games and sets aren't scored by anyone's play). Every other sport's is only in the game's summary, which is
    /// large, so it's asked for only when the score has changed since it was last asked for. If the summary
    /// hasn't caught up with the score yet, has no scoring plays, or the request fails, it's asked for again
    /// next time, up to <see cref="SummaryTries"/> times at one score; the last score stays as it was meanwhile.
    /// </summary>
    private async Task<ProviderGame> WithLastScoreAsync(ProviderGame game, string league, CancellationToken cancellationToken)
    {
        if (game.LastScore is not null || league.StartsWith("soccer/", StringComparison.Ordinal) || league.StartsWith("rugby/", StringComparison.Ordinal)
            || league.StartsWith("cricket/", StringComparison.Ordinal) || league.StartsWith("tennis/", StringComparison.Ordinal)
            || game.Contest is not ProviderSides { Home.Score: { } home, Away.Score: { } away } || home + away == 0)
            return game;

        var key = $"{game.LeagueKey}/{game.Id}";
        var score = $"{home}-{away}";
        var known = _lastScores.GetValueOrDefault(key);
        var triesLeft = known.Score == score ? known.TriesLeft : SummaryTries;
        if (triesLeft == 0)
            return game with { LastScore = known.Play };
        _lastScores[key] = (score, triesLeft - 1, known.Play);
        try
        {
            var summary = await http.GetFromJsonAsync<Summary>($"{league}/summary?event={game.Id}", cancellationToken);
            // Football's summary lists its scoring plays; the other sports' only list every play.
            var plays = summary?.ScoringPlays ?? summary?.Plays?.Where(p => p.ScoringPlay == true).ToList() ?? [];
            if (plays.LastOrDefault() is not { } last)
                return game with { LastScore = known.Play };
            var play = ToScoringPlay(last, summary!.Header?.Competitions?.FirstOrDefault()?.Competitors ?? []) ?? known.Play;
            var caughtUp = last.HomeScore == home && last.AwayScore == away;
            _lastScores[key] = (score, caughtUp ? 0 : triesLeft - 1, play);
            return game with { LastScore = play };
        }
        catch (Exception ex) when (ex is HttpRequestException or System.Text.Json.JsonException
            || (ex is TaskCanceledException && !cancellationToken.IsCancellationRequested))
        {
            return game with { LastScore = known.Play };
        }
    }

    /// <summary>
    /// ESPN's Top Events, as its front page shows them: its scoreboard header, asked with no sport. It's
    /// on another host from the scoreboards, so the address is whole.
    /// </summary>
    private const string TopEventsUrl =
        "https://site.web.api.espn.com/apis/personalized/v2/scoreboard/header?region=us&lang=en&contentorigin=espn&configuration=SITE_DEFAULT&platform=web";

    /// <summary>
    /// The ids of ESPN's Top Events. An event's id is its game's, but for tennis, whose event is a whole
    /// tournament, the match's id is its competition id, so both are listed.
    /// </summary>
    public async Task<IReadOnlySet<string>> FetchTopEventsAsync(CancellationToken cancellationToken)
    {
        var header = await http.GetFromJsonAsync<Header>(TopEventsUrl, cancellationToken);
        return (header?.Sports ?? [])
            .SelectMany(sport => sport.Leagues ?? [])
            .SelectMany(league => league.Events ?? [])
            .SelectMany(e => new[] { e.Id, e.CompetitionId })
            .OfType<string>()
            .ToHashSet();
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
        var rugby = leagueKey.StartsWith("rugby/", StringComparison.Ordinal);
        var keyEvents = !started ? [] : rugby ? ToRugbyKeyEvents(competition.Details, teams) : ToKeyEvents(competition.Details, teams);

        return new ProviderGame(
            e.Id,
            leagueKey,
            e.Date ?? competition!.Date ?? DateTimeOffset.MinValue,
            new ProviderSides(ToTeam(home, started, leagueKey), ToTeam(away, started, leagueKey)),
            ToStatus(status?.Type),
            started ? status?.DisplayClock : null,
            started ? status?.Period : null,
            ToVenue(competition!.Venue),
            ToBroadcasters(competition.Broadcasts, competition.GeoBroadcasts),
            status?.Type?.State == "in" ? ToPhase(status.Type) : ProviderPeriodPhase.Playing)
        {
            Note = ToNote(competition.Notes),
            Attendance = competition.Attendance > 0 ? competition.Attendance : null,
            Odds = ToOdds(competition.Odds?.FirstOrDefault()),
            Situation = status?.Type?.State == "in" ? ToSituation(competition.Situation, teams) : null,
            KeyEvents = keyEvents,
            LastScore = keyEvents.LastOrDefault(k => k.Kind is not (KeyEventKind.YellowCard or KeyEventKind.RedCard)) is { } score
                ? new ProviderScoringPlay(score.Team, ScoreText(score, rugby), null, score.Clock)
                : null,
        };
    }

    /// <summary>
    /// Tennis: each event is a tournament, its matches the competitions under its groupings (Women's
    /// Singles, Women's Doubles…). One game per main-draw singles match whose two players are known:
    /// doubles, qualifying rounds and matches with a side still to be decided are left out. A match's
    /// id is its competition's, as ESPN's Top Events give it.
    /// </summary>
    private static IEnumerable<ProviderGame> ToMatches(Event tournament, string leagueKey)
    {
        var singles = (tournament.Groupings ?? [])
            .Where(g => g.Grouping?.Slug is "mens-singles" or "womens-singles")
            .SelectMany(g => g.Competitions ?? []);
        foreach (var match in singles)
        {
            var home = match.Competitors?.FirstOrDefault(c => c.HomeAway == "home");
            var away = match.Competitors?.FirstOrDefault(c => c.HomeAway == "away");
            var round = NullIfBlank(match.Round?.DisplayName);
            if (match.Id is null || !IsKnownPlayer(home) || !IsKnownPlayer(away)
                || round?.StartsWith("Qualifying", StringComparison.OrdinalIgnoreCase) == true)
                continue;

            var status = ToStatus(match.Status?.Type);
            var started = match.Status?.Type?.State is "in" or "post";
            var sets = started ? ToSets(home!, away!) : [];
            var name = NullIfBlank(tournament.Name);
            yield return new ProviderGame(
                match.Id,
                leagueKey,
                match.Date ?? tournament.Date ?? DateTimeOffset.MinValue,
                new ProviderSides(
                    ToPlayer(home!, sets.Count > 0 ? sets.Count(set => set.HomeWon == true) : null),
                    ToPlayer(away!, sets.Count > 0 ? sets.Count(set => set.HomeWon == false) : null)),
                status,
                null,
                started ? match.Status?.Period : null,
                new ProviderVenue(name, NullIfBlank(match.Venue?.FullName), null, null, Court: NullIfBlank(match.Venue?.Court)),
                ToBroadcasters(match.Broadcasts, match.GeoBroadcasts))
            {
                Note = string.Join(" · ", new[] { name, ShortRound(round) }.OfType<string>()) is { Length: > 0 } note ? note : null,
                Odds = ToOdds(match.Odds?.FirstOrDefault()),
                Sets = sets,
                EarlyEnding = ToEarlyEnding(match.Status?.Type, home!, away!),
            };
        }
    }

    /// <summary>
    /// Racing: each event is one game, its race, among a field of drivers ranked by their <c>order</c>; none
    /// are listed before it starts. A NASCAR event has one competition, the race; an F1 weekend has five
    /// (FP1–FP3, qualifying and the race), and only the race counts (ADR-0020), so the game's start, status,
    /// lap and field are the race's, its id the event's. Its period is the current lap, and its note the
    /// event's name. Its venue is the event's <c>circuit</c> (F1); NASCAR's scoreboard gives none (see
    /// <see cref="EventVenueAsync"/>), and nor does IndyCar's (see <see cref="TrackList"/>).
    /// </summary>
    private static ProviderGame? ToFieldGame(Event e, string leagueKey)
    {
        var competitions = e.Competitions ?? [];
        // A competition that names its session must be the race; one that doesn't is NASCAR's only one.
        var competition = competitions.Count == 1 && competitions[0].Type?.Abbreviation is null
            ? competitions[0]
            : competitions.FirstOrDefault(c => c.Type?.Abbreviation == "Race");
        if (e.Id is null || competition is null)
            return null;
        // An F1 event's own status isn't the race's: it reads Final while practice runs.
        var status = competition.Status ?? e.Status;
        var started = status?.Type?.State is "in" or "post";
        var entries = (competition.Competitors ?? [])
            .Where(c => c.Order is not null && !string.IsNullOrWhiteSpace(c.Athlete?.DisplayName))
            .OrderBy(c => c.Order)
            .Select(c => new ProviderEntrant(c.Order!.Value, c.Athlete!.DisplayName!.Trim(),
                NullIfBlank(c.Athlete.ShortName) ?? c.Athlete.DisplayName.Trim(), c.Athlete.Flag?.Href))
            .ToList();
        return new ProviderGame(
            e.Id,
            leagueKey,
            competition.Date ?? e.Date ?? DateTimeOffset.MinValue,
            new ProviderField(entries),
            ToStatus(status?.Type),
            null,
            started ? status?.Period : null,
            ToVenue(e.Circuit),
            ToBroadcasters(competition.Broadcasts, competition.GeoBroadcasts))
        {
            Note = NullIfBlank(e.Name),
        };
    }

    /// <summary>
    /// MMA: each event is one game, its fight card (ADR-0020), with one competition a bout, listed in the
    /// order they're fought, the main event last; the game lists them main event first. A bout's own date is
    /// only the start of its part of the card (prelims or main card), so the card's progress comes from the
    /// bouts' statuses (see <see cref="ProviderBouts.Status"/>), the event's own only for a card called off. Its
    /// start is the first bout's, its venue the bouts' (each gives the same one), its note the event's name,
    /// and its broadcasters the main event's.
    /// </summary>
    private static ProviderGame? ToFightCard(Event e, string leagueKey)
    {
        var bouts = (e.Competitions ?? []).Select(ToBout).OfType<ProviderBout>().Reverse().ToList();
        if (e.Id is null || bouts.Count == 0)
            return null;
        var competitions = e.Competitions!;
        var main = competitions[^1];
        var card = new ProviderBouts(bouts);
        return new ProviderGame(
            e.Id,
            leagueKey,
            competitions.Select(c => c.Date).Min() ?? e.Date ?? DateTimeOffset.MinValue,
            card,
            card.Status(ToStatus(e.Status?.Type)),
            null,
            null,
            ToVenue(competitions.Select(c => c.Venue).FirstOrDefault(venue => venue is not null)),
            ToBroadcasters(main.Broadcasts, main.GeoBroadcasts))
        {
            Note = NullIfBlank(e.Name),
        };
    }

    /// <summary>
    /// A bout: its sides in ESPN's <c>order</c>, its weight class (its type's abbreviation), its scheduled rounds,
    /// and once started its round and the time into it. How it was won is the last "Unofficial Winner" detail
    /// ESPN gave, which it may correct (a decision, then a KO/TKO); details are listed newest first.
    /// </summary>
    private static ProviderBout? ToBout(Competition bout)
    {
        var sides = (bout.Competitors ?? [])
            .Where(c => c.Order is 1 or 2 && !string.IsNullOrWhiteSpace(c.Athlete?.DisplayName))
            .OrderBy(c => c.Order)
            .Select(c => new ProviderBoutSide(c.Athlete!.DisplayName!.Trim(), NullIfBlank(c.Athlete.ShortName) ?? c.Athlete.DisplayName.Trim(),
                c.Athlete.Flag?.Href, NullIfBlank(c.Records?.FirstOrDefault(r => r.Type == "total")?.Summary), c.Won))
            .ToList();
        if (bout.Id is null || sides is not [var first, var second])
            return null;
        var status = ToStatus(bout.Status?.Type);
        var started = bout.Status?.Type?.State is "in" or "post" && bout.Status.Period > 0;
        return new ProviderBout(
            bout.Id,
            first,
            second,
            NullIfBlank(bout.Type?.Abbreviation),
            bout.Format?.Regulation?.Periods ?? 3,
            status,
            started ? bout.Status!.Period : null,
            started ? NullIfBlank(bout.Status!.DisplayClock) : null,
            status == ProviderStatus.Final ? BoutMethodOf(bout.Details) : null);
    }

    private static BoutMethod? BoutMethodOf(List<Detail>? details) =>
        (details ?? []).Select(detail => detail.Type?.Text).FirstOrDefault(text => text?.StartsWith("Unofficial Winner ", StringComparison.Ordinal) == true) switch
        {
            "Unofficial Winner Kotko" => BoutMethod.KnockOut,
            "Unofficial Winner Submission" => BoutMethod.Submission,
            "Unofficial Winner Decision" => BoutMethod.Decision,
            _ => null,
        };

    /// <summary>
    /// Golf: each event is one game, its tournament, with one competition. Its field is ranked by
    /// <c>order</c>, which ESPN keeps unique even for ties, so golfers level on score to par share a position
    /// (see <see cref="ProviderField.TiedByScore"/>). Its period is the current round, and the holes each golfer
    /// has played of it are the hole scores in their linescore for that round. Play is between rounds once no
    /// one is part-way through one (see <see cref="Rounds"/>). Its scoreboard gives no venue (see
    /// <see cref="EventVenueAsync"/>).
    /// </summary>
    private static ProviderGame? ToTournament(Event e, string leagueKey)
    {
        if (e.Id is null || e.Competitions?.FirstOrDefault() is not { } competition)
            return null;
        var status = competition.Status ?? e.Status;
        var started = status?.Type?.State is "in" or "post";
        var round = started ? status?.Period : null;
        var golfers = (competition.Competitors ?? [])
            .Where(c => c.Order is not null && !string.IsNullOrWhiteSpace(c.Athlete?.DisplayName))
            .OrderBy(c => c.Order)
            .Select(c => new ProviderEntrant(0, c.Athlete!.DisplayName!.Trim(),
                NullIfBlank(c.Athlete.ShortName) ?? c.Athlete.DisplayName.Trim(), c.Athlete.Flag?.Href,
                ToPar(c.Score), round is { } r ? HolesPlayed(c, r) : null))
            .ToList();
        var (period, phase) = status?.Type?.State == "in" && round is { } current
            ? Rounds(current, golfers)
            : (round, ProviderPeriodPhase.Playing);
        return new ProviderGame(
            e.Id,
            leagueKey,
            competition.Date ?? e.Date ?? DateTimeOffset.MinValue,
            ProviderField.TiedByScore(golfers),
            ToStatus(status?.Type),
            null,
            period,
            null,
            ToBroadcasters(competition.Broadcasts, competition.GeoBroadcasts),
            phase)
        {
            Note = NullIfBlank(e.Name),
        };
    }

    /// <summary>A score to par as golf writes it ("-12", "E", "+3"); null for anything else.</summary>
    private static int? ToPar(string? score) =>
        score?.Trim() == "E" ? 0 : int.TryParse(score, System.Globalization.NumberStyles.AllowLeadingSign, null, out var toPar) ? toPar : null;

    /// <summary>The holes a golfer has played of a round: the hole scores in their linescore for it.</summary>
    private static int HolesPlayed(Competitor golfer, int round) =>
        golfer.Linescores?.FirstOrDefault(l => l.Period == round)?.Linescores?.Count ?? 0;

    /// <summary>
    /// ESPN's round and whether play is between rounds, which it doesn't say (ADR-0020): it is once some
    /// golfers have played the round and none is part-way through it, or, from round 2, before anyone has
    /// begun it, when it's after the round before.
    /// </summary>
    private static (int Round, ProviderPeriodPhase Phase) Rounds(int round, List<ProviderEntrant> golfers)
    {
        if (golfers.Any(g => g.Thru is > 0 and < HolesInARound))
            return (round, ProviderPeriodPhase.Playing);
        if (golfers.Any(g => g.Thru == HolesInARound))
            return (round, ProviderPeriodPhase.Break);
        return round > 1 ? (round - 1, ProviderPeriodPhase.Break) : (round, ProviderPeriodPhase.Playing);
    }

    private const int HolesInARound = 18;

    /// <summary>ESPN's core API, a second unofficial endpoint (ADR-0001, ADR-0020), on its own host.</summary>
    private const string CoreApi = "https://sports.core.api.espn.com/v2/sports/";

    /// <summary>
    /// An event's venue, for a league whose scoreboard gives none: golf's core API event lists its courses,
    /// and the first gives the venue's name and address; any other's lists its venues as links, and the
    /// first gives its name and address. Asked for once per event, and every answer (no
    /// venue too) saved to <c>savedEventVenuesPath</c>, so later runs don't ask again; a failed request
    /// isn't saved, so it's asked again next time.
    /// </summary>
    private async Task<ProviderVenue?> EventVenueAsync(string league, string eventId, CancellationToken cancellationToken)
    {
        var key = $"{league}/{eventId}";
        await _eventVenuesGate.WaitAsync(cancellationToken);
        try
        {
            _eventVenues ??= await LoadEventVenuesAsync(cancellationToken);
            if (_eventVenues.TryGetValue(key, out var known))
                return known;
            var (sport, name) = league.Split('/', 2) switch
            {
                [var s, var l] => (s, l),
                _ => (league, ""),
            };
            var coreEvent = await http.GetFromJsonAsync<CoreEvent>($"{CoreApi}{sport}/leagues/{name}/events/{eventId}", cancellationToken);
            ProviderVenue? venue = null;
            if (coreEvent?.Courses?.FirstOrDefault() is { Name: { } course } first && !string.IsNullOrWhiteSpace(course))
                venue = ToVenue(new Venue(first.Id, course.Trim(), first.Address, null));
            else if (coreEvent?.Venues?.FirstOrDefault()?.Ref is { } link)
            {
                // The core API links over plain http; it answers the same over https.
                var https = new UriBuilder(link) { Scheme = Uri.UriSchemeHttps, Port = -1 }.Uri;
                venue = ToVenue(await http.GetFromJsonAsync<Venue>(https, cancellationToken));
            }
            _eventVenues[key] = venue;
            await SaveEventVenuesAsync(_eventVenues, cancellationToken);
            return venue;
        }
        catch (Exception ex) when (ex is HttpRequestException or System.Text.Json.JsonException or UriFormatException
            || (ex is TaskCanceledException && !cancellationToken.IsCancellationRequested))
        {
            return null;
        }
        finally
        {
            _eventVenuesGate.Release();
        }
    }

    /// <summary>The saved venues; none when there's no file, or one that can't be read, so each venue is asked for again.</summary>
    private async Task<Dictionary<string, ProviderVenue?>> LoadEventVenuesAsync(CancellationToken cancellationToken)
    {
        if (savedEventVenuesPath is null || !File.Exists(savedEventVenuesPath))
            return new Dictionary<string, ProviderVenue?>();
        try
        {
            await using var file = File.OpenRead(savedEventVenuesPath);
            return await System.Text.Json.JsonSerializer.DeserializeAsync<Dictionary<string, ProviderVenue?>>(file, SavedJson, cancellationToken)
                ?? new Dictionary<string, ProviderVenue?>();
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException or System.Text.Json.JsonException)
        {
            return new Dictionary<string, ProviderVenue?>();
        }
    }

    /// <summary>
    /// Saves through a temp file, so a crash mid-write never leaves a half-written file. A save that fails
    /// leaves the venues known until the server restarts, and the next venue found tries the save again.
    /// </summary>
    private async Task SaveEventVenuesAsync(Dictionary<string, ProviderVenue?> saved, CancellationToken cancellationToken)
    {
        if (savedEventVenuesPath is null)
            return;
        try
        {
            Directory.CreateDirectory(Path.GetDirectoryName(Path.GetFullPath(savedEventVenuesPath))!);
            var temp = savedEventVenuesPath + ".tmp";
            await using (var file = File.Create(temp))
                await System.Text.Json.JsonSerializer.SerializeAsync(file, saved, SavedJson, cancellationToken);
            File.Move(temp, savedEventVenuesPath, overwrite: true);
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
        {
        }
    }

    /// <summary>
    /// A round in tennis's shorthand, so the game panel's note fits on its one line: "R1", "R16", "QF",
    /// "SF"; any other ("Final") as ESPN names it.
    /// </summary>
    private static string? ShortRound(string? round) => round switch
    {
        "Quarterfinal" => "QF",
        "Semifinal" => "SF",
        _ when RoundNumber().Match(round ?? "") is { Success: true } numbered => $"R{numbered.Groups[1].Value}",
        _ => round,
    };

    [GeneratedRegex(@"^Round (?:of )?(\d+)$")]
    private static partial Regex RoundNumber();

    /// <summary>A side ESPN has named a player for, not one still "TBD" (to be decided).</summary>
    private static bool IsKnownPlayer(MatchSide? competitor) =>
        competitor?.Athlete?.DisplayName is { } name && !string.IsNullOrWhiteSpace(name) && name != "TBD";

    /// <summary>A player as a side: ESPN's short name where a team's abbreviation goes, and their country's flag where its logo goes.</summary>
    private static ProviderTeam ToPlayer(MatchSide competitor, int? setsWon) =>
        new(competitor.Athlete!.ShortName ?? competitor.Athlete.DisplayName!, competitor.Athlete.DisplayName!,
            competitor.Athlete.Flag?.Href, setsWon);

    /// <summary>Each set's games and who won it, from both sides' linescores, which list the sets in order.</summary>
    private static IReadOnlyList<ProviderSet> ToSets(MatchSide home, MatchSide away)
    {
        var (homeSets, awaySets) = (home.Linescores ?? [], away.Linescores ?? []);
        return homeSets.Zip(awaySets, (h, a) =>
        {
            var (homeGames, awayGames) = ((int)(h.Value ?? 0), (int)(a.Value ?? 0));
            bool? homeWon = WonSet(h, homeGames, awayGames) ? true : WonSet(a, awayGames, homeGames) ? false : null;
            return new ProviderSet(homeGames, awayGames, h.Tiebreak, a.Tiebreak, homeWon);
        }).ToList();
    }

    /// <summary>
    /// Whether a side won a set. ESPN marks the winner of each finished set, but not always the last one
    /// finished before a retirement, so a set that's plainly over counts too: 6 games or more and 2 clear,
    /// or 7-6.
    /// </summary>
    private static bool WonSet(Linescore side, int games, int against) =>
        side.Winner == true || (games >= 6 && games - against >= 2) || (games == 7 && against == 6);

    /// <summary>Why a Final match ended early, and the side ESPN marks as its winner if it marks one; null for one played out.</summary>
    private static ProviderEarlyEnding? ToEarlyEnding(StatusType? type, MatchSide home, MatchSide away)
    {
        var name = type?.Name ?? "";
        EarlyEndingReason? reason = name.Contains("RETIRED") ? EarlyEndingReason.Retired
            : name.Contains("WALKOVER") ? EarlyEndingReason.Walkover
            : null;
        var winner = home.Winner == true ? home : away.Winner == true ? away : null;
        return reason is { } why ? new ProviderEarlyEnding(why, winner is null ? null : ToPlayer(winner, null).Abbreviation) : null;
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

    /// <summary>
    /// Rugby's scores and cards, from the scoreboard's details, which name each by its type ("try", "conversion",
    /// "penalty goal", "drop goal", "yellow card"); substitutions and anything else are left out.
    /// </summary>
    private static IReadOnlyList<ProviderKeyEvent> ToRugbyKeyEvents(List<Detail>? details, Dictionary<string, string> teams)
    {
        var events = new List<ProviderKeyEvent>();
        foreach (var detail in details ?? [])
        {
            if (detail.Team?.Id is not { } id || !teams.TryGetValue(id, out var team))
                continue;
            KeyEventKind? kind = detail.Type?.Text?.Trim().ToLowerInvariant() switch
            {
                "try" or "penalty try" => KeyEventKind.Try,
                "conversion" => KeyEventKind.Conversion,
                "penalty goal" => KeyEventKind.PenaltyGoal,
                "drop goal" => KeyEventKind.DropGoal,
                "yellow card" => KeyEventKind.YellowCard,
                "red card" => KeyEventKind.RedCard,
                _ => null,
            };
            if (kind is not null)
                events.Add(new ProviderKeyEvent(kind.Value, team,
                    NullIfBlank(detail.AthletesInvolved?.FirstOrDefault()?.DisplayName), detail.Clock?.DisplayValue));
        }
        return events;
    }

    /// <summary>A score as the last score reads it: "Goal: Declan Rice", "Penalty: Bukayo Saka", "Try: Paolo Garbisi", "Penalty goal: Thomas Ramos".</summary>
    private static string ScoreText(ProviderKeyEvent score, bool rugby)
    {
        var what = score.Kind switch
        {
            KeyEventKind.PenaltyGoal => rugby ? "Penalty goal" : "Penalty",
            KeyEventKind.OwnGoal => "Own goal",
            KeyEventKind.Try => "Try",
            KeyEventKind.Conversion => "Conversion",
            KeyEventKind.DropGoal => "Drop goal",
            _ => "Goal",
        };
        return score.Player is { } player ? $"{what}: {player}" : what;
    }

    private static ProviderTeam ToTeam(Competitor competitor, bool started, string leagueKey)
    {
        var team = new ProviderTeam(competitor.Team!.Abbreviation ?? "",
            competitor.Team.DisplayName ?? competitor.Team.Abbreviation ?? "",
            competitor.Team.Logo,
            started && int.TryParse(competitor.Score, out var score) ? score : null,
            Rank: competitor.CuratedRank?.Current is >= 1 and <= TopRanked ? competitor.CuratedRank.Current : null,
            // Rugby's "total" is the side's form ("LWWWW"), not a record.
            Record: leagueKey.StartsWith("rugby/", StringComparison.Ordinal) ? null
                : NullIfBlank(competitor.Records?.FirstOrDefault(r => r.Type == "total")?.Summary));
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

    private static IReadOnlyList<ProviderBroadcaster> ToBroadcasters(List<Broadcast>? broadcasts, List<GeoBroadcast>? geoBroadcasts)
    {
        var geo = (geoBroadcasts ?? [])
            .Where(b => b.Media?.ShortName is not null && !string.Equals(b.Type?.ShortName, "Radio", StringComparison.OrdinalIgnoreCase))
            .Select(b => new ProviderBroadcaster(b.Media!.ShortName!, b.Region?.ToUpperInvariant()));
        var plain = (broadcasts ?? [])
            .SelectMany(b => b.Names ?? [])
            .Select(name => new ProviderBroadcaster(name, null));
        var broadcasters = geo.Any() ? geo : plain;
        return broadcasters.Distinct().ToList();
    }

    // ESPN response shape (only the fields ScoreMap reads).
    private sealed record Scoreboard(List<Event>? Events);
    private sealed record Header(List<HeaderSport>? Sports);
    private sealed record HeaderSport(List<HeaderLeague>? Leagues);
    private sealed record HeaderLeague(List<HeaderEvent>? Events);
    private sealed record HeaderEvent(string? Id, string? CompetitionId);
    private sealed record Event(string? Id, DateTimeOffset? Date, List<Competition>? Competitions, Status? Status,
        string? Name, List<EventGrouping>? Groupings, Venue? Circuit);
    private sealed record Competition(string? Id, DateTimeOffset? Date, Venue? Venue, List<Competitor>? Competitors, Status? Status,
        List<Broadcast>? Broadcasts, List<GeoBroadcast>? GeoBroadcasts, int? Attendance, List<Odds>? Odds,
        Situation? Situation, List<Detail>? Details, List<Note>? Notes, CompetitionType? Type, Format? Format);
    // F1: which session of the weekend a competition is ("FP1", "Qual", "Race"); MMA: a bout's weight class.
    private sealed record CompetitionType(string? Abbreviation);
    private sealed record Note(string? Headline);
    // MMA: a bout's scheduled rounds.
    private sealed record Format(Regulation? Regulation);
    private sealed record Regulation(int? Periods);
    // Racing: a driver, with their running position (order), in place of a team. MMA: a bout's side, in its
    // corner's order, with whether they won (cricket writes it as text, "true").
    // Golf: a golfer, with a linescore per round, each listing the holes played of it.
    private sealed record Competitor(string? Id, string? HomeAway, Team? Team, string? Score, List<TeamRecord>? Records,
        CuratedRank? CuratedRank, int? Order, Player? Athlete, System.Text.Json.JsonElement? Winner, List<Linescore>? Linescores)
    {
        public bool Won => Winner is { ValueKind: System.Text.Json.JsonValueKind.True }
            || Winner is { ValueKind: System.Text.Json.JsonValueKind.String } text && text.GetString() == "true";
    }
    // Tennis: a tournament's matches, under its groupings.
    private sealed record EventGrouping(GroupingType? Grouping, List<Match>? Competitions);
    private sealed record GroupingType(string? Slug);
    private sealed record Match(string? Id, DateTimeOffset? Date, Venue? Venue, List<MatchSide>? Competitors, Status? Status,
        List<Broadcast>? Broadcasts, List<GeoBroadcast>? GeoBroadcasts, List<Odds>? Odds, Round? Round);
    private sealed record Round(string? DisplayName);
    private sealed record MatchSide(string? HomeAway, Player? Athlete, List<Linescore>? Linescores, bool? Winner);
    private sealed record Player(string? DisplayName, string? ShortName, Flag? Flag);
    private sealed record Flag(string? Href);
    private sealed record Linescore(double? Value, int? Tiebreak, bool? Winner, int? Period, List<Linescore>? Linescores);
    private sealed record TeamRecord(string? Type, string? Summary);
    private sealed record CuratedRank(int? Current);
    private sealed record Odds(string? Details, double? OverUnder, OddsProvider? Provider);
    private sealed record OddsProvider(string? Name);
    private sealed record Situation(LastPlay? LastPlay, string? DownDistanceText, string? Possession,
        int? Balls, int? Strikes, int? Outs, bool? OnFirst, bool? OnSecond, bool? OnThird);
    private sealed record LastPlay(string? Text);
    private sealed record Detail(Clock? Clock, TeamRef? Team, bool? ScoringPlay, bool? RedCard, bool? YellowCard,
        bool? PenaltyKick, bool? OwnGoal, bool? Shootout, List<Athlete>? AthletesInvolved, DetailType? Type);
    // MMA: what happened in a bout ("Takedown", "Unofficial Winner Kotko").
    private sealed record DetailType(string? Text);
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
    private sealed record Venue(string? Id, string? FullName, Address? Address, string? Court);
    private sealed record Address(string? City, string? State, string? Country);
    // The core API: an event, its venues as links, and in golf its courses.
    private sealed record CoreEvent(List<CoreLink>? Venues, List<CoreCourse>? Courses);
    private sealed record CoreCourse(string? Id, string? Name, Address? Address);
    private sealed record CoreLink([property: System.Text.Json.Serialization.JsonPropertyName("$ref")] string? Ref);
    private sealed record Broadcast(string? Market, List<string>? Names);
    private sealed record GeoBroadcast(GeoBroadcastType? Type, GeoMedia? Media, string? Region);
    private sealed record GeoBroadcastType(string? ShortName);
    private sealed record GeoMedia(string? ShortName);
}
