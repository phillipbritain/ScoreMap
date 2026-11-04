using GeoTimeZone;
using Microsoft.Extensions.Options;
using ScoreMap.Server.GameFeed;
using ScoreMap.Server.Venues;
using ScoreMap.Server.WatchLinks;

namespace ScoreMap.Server.Games;

/// <summary>
/// Holds the current set of games and turns provider data plus the current time into
/// ScoreMap's games: it maps provider statuses to ScoreMap's and keeps only games inside
/// their pin windows. Each update of a league compares the result with the last one and
/// reports what changed, so games entering and leaving their windows come out as added
/// and removed. It also keeps which games are top events (see <see cref="UpdateTopEvents"/>).
/// State access is not thread-safe: the poller serializes reads and updates. Fetch and lookup
/// methods perform only external work and may run concurrently.
/// </summary>
public sealed class GameBoard(
    IGameFeedProvider feed,
    VenueLocator venues,
    VenuePhotos photos,
    OfficialWatchLinks watchLinks,
    IStreamLinkSource streams,
    IOptions<List<League>> leagues,
    TimeProvider clock)
{
    /// <summary>An Upcoming game gets its pin this long before its start.</summary>
    public static readonly TimeSpan UpcomingWindow = TimeSpan.FromHours(3);

    /// <summary>A Final game keeps its pin this long after its end.</summary>
    public static readonly TimeSpan FinalWindow = TimeSpan.FromHours(2);

    private readonly Dictionary<string, IReadOnlyList<Game>> _games = new();

    // The ids of the games the feed last listed as its top events.
    private IReadOnlySet<string> _topEvents = new HashSet<string>();

    // Providers report no end or suspension time, so a game ends (or is suspended) when the board sees
    // it turn Final (or suspended). Keyed by game: the status it was last seen with, and for a stopped
    // game when it stopped.
    private readonly Dictionary<(string LeagueKey, string GameId), (ProviderStatus Status, DateTimeOffset? StoppedAt)> _sightings = new();

    public IReadOnlyList<League> Leagues => leagues.Value;

    /// <summary>Every game currently on the board, across all leagues.</summary>
    public IReadOnlyList<Game> Games => _games.Values.SelectMany(g => g).ToList();

    private readonly Dictionary<string, IReadOnlyList<ProviderGame>> _reported = new();

    // Fetching and venue resolution do not touch board state and may run outside its serialization gate.
    public Task<IReadOnlyList<ProviderGame>> FetchLeagueAsync(League league, CancellationToken cancellationToken) =>
        feed.FetchScoreboardAsync(league.Key, cancellationToken);

    public Task<IReadOnlySet<string>> FetchTopEventsAsync(CancellationToken cancellationToken) =>
        feed.FetchTopEventsAsync(cancellationToken);

    /// <summary>Applies basic game data without waiting for optional venue lookups.</summary>
    public IReadOnlyList<GameChange> UpdateLeague(League league, IReadOnlyList<ProviderGame> scoreboard, CancellationToken cancellationToken)
    {
        var now = clock.GetUtcNow();
        ForgetGamesNoLongerReported(league.Key, scoreboard);
        var games = new List<Game>();
        foreach (var reported in scoreboard)
        {
            var game = reported;
            if (ToStatus(game.Status) is not { } status)
                continue;
            var stoppedAt = RecordSighting(league, game, now);
            if (!IsInPinWindow(game, status, stoppedAt, league, now))
                continue;
            game = feed.EnrichGame(game, cancellationToken);
            var endTime = status == GameStatus.Final ? stoppedAt : null;
            var previous = _reported.GetValueOrDefault(league.Key, []).FirstOrDefault(g => g.Id == game.Id);
            var previousGame = _games.GetValueOrDefault(league.Key, []).FirstOrDefault(g => g.Id == game.Id);
            var location = venues.Fallback(game.Venue);
            if (location.FoundBy == LocationSource.Nowhere && previousGame is not null && SameVenue(previous, game))
                location = new(new Coordinates(previousGame.Venue.Latitude, previousGame.Venue.Longitude),
                    previousGame.Venue.TimeZone is null ? LocationSource.Nowhere : LocationSource.Venue);
            var added = ToGame(game, status, endTime, league, location);
            games.Add(added with { StreamLinks = streams.LinksFor(added) });
        }

        var before = _games.GetValueOrDefault(league.Key, []);
        _games[league.Key] = games;
        _reported[league.Key] = scoreboard;
        return GameChanges.Between(before, games);
    }

    /// <summary>Only games currently inside their pin windows need optional enrichment.</summary>
    public IReadOnlyList<ProviderGame> GamesToEnrich(League league) =>
        _reported.GetValueOrDefault(league.Key, []).Where(g =>
            _games.GetValueOrDefault(league.Key, []).Any(shown => shown.Id == g.Id)).ToList();

    public Task<VenueLocation> LocateVenueAsync(ProviderGame game, CancellationToken cancellationToken) =>
        venues.LocateAsync(game.Venue, (game.Contest as ProviderSides)?.Home, cancellationToken);

    /// <summary>Enriches the current game, preserving any scores received during the lookup.</summary>
    public IReadOnlyList<GameChange> UpdateVenue(League league, ProviderGame requested, VenueLocation location)
    {
        var current = _reported.GetValueOrDefault(league.Key, []).FirstOrDefault(g => g.Id == requested.Id);
        if (!SameVenue(current, requested))
            return [];
        var before = _games.GetValueOrDefault(league.Key, []);
        var after = before.Select(g => g.Id == requested.Id
            ? g with { Venue = ToVenue(requested.Venue, location) with { Photo = g.Venue.Photo } }
            : g).ToList();
        _games[league.Key] = after;
        return GameChanges.Between(before, after);
    }

    private static bool SameVenue(ProviderGame? a, ProviderGame b) => a is not null &&
        a.Venue == b.Venue && (a.Contest as ProviderSides)?.Home.HomeCity == (b.Contest as ProviderSides)?.Home.HomeCity;

    public IReadOnlyList<GameChange> UpdateTopEvents(IReadOnlySet<string> topEvents, IReadOnlySet<string> currentLeagues)
    {
        _topEvents = topEvents;
        var changes = new List<GameChange>();
        foreach (var (key, before) in _games)
        {
            if (!currentLeagues.Contains(key))
                continue;
            var after = before.Select(g => g with { TopEvent = topEvents.Contains(g.Id) }).ToList();
            changes.AddRange(GameChanges.Between(before, after));
            _games[key] = after;
        }
        return changes;
    }

    public bool HasLiveGames(League league) =>
        _games.TryGetValue(league.Key, out var games) && games.Any(g => g.Status == GameStatus.Live);

    /// <summary>
    /// Breaks (halftime, intermissions) arrive as in progress; delays stay Live too.
    /// Postponed, suspended and canceled games are Disrupted.
    /// </summary>
    private static GameStatus? ToStatus(ProviderStatus status) => status switch
    {
        ProviderStatus.Scheduled => GameStatus.Upcoming,
        ProviderStatus.InProgress or ProviderStatus.Delayed => GameStatus.Live,
        ProviderStatus.Final => GameStatus.Final,
        ProviderStatus.Postponed or ProviderStatus.Suspended or ProviderStatus.Canceled => GameStatus.Disrupted,
        _ => null,
    };

    private static Disruption? ToDisruption(ProviderStatus status) => status switch
    {
        ProviderStatus.Postponed => Disruption.Postponed,
        ProviderStatus.Suspended => Disruption.Suspended,
        ProviderStatus.Canceled => Disruption.Canceled,
        _ => null,
    };

    /// <summary>
    /// For a Final or suspended game, when it stopped (its end or suspension); null for any other game.
    /// A game the board saw turn Final or suspended stopped when the board first saw it so. A game already
    /// stopped the first time the board sees it (say, after the server slept) stopped at an unknown time,
    /// estimated as its planned end, or now if that is still to come.
    /// </summary>
    private DateTimeOffset? RecordSighting(League league, ProviderGame game, DateTimeOffset now)
    {
        var key = (league.Key, game.Id);
        var seenBefore = _sightings.TryGetValue(key, out var last);
        if (game.Status is not (ProviderStatus.Final or ProviderStatus.Suspended))
        {
            _sightings[key] = (game.Status, null);
            return null;
        }
        if (seenBefore && last.Status == game.Status)
            return last.StoppedAt;

        var stoppedAt = seenBefore ? now : Min(game.StartTime + league.PlannedLength, now);
        _sightings[key] = (game.Status, stoppedAt);
        return stoppedAt;
    }

    private static DateTimeOffset Min(DateTimeOffset a, DateTimeOffset b) => a < b ? a : b;

    private void ForgetGamesNoLongerReported(string leagueKey, IReadOnlyList<ProviderGame> scoreboard)
    {
        var reported = scoreboard.Select(g => g.Id).ToHashSet();
        foreach (var key in _sightings.Keys.ToList())
            if (key.LeagueKey == leagueKey && !reported.Contains(key.GameId))
                _sightings.Remove(key);
    }

    private static bool IsInPinWindow(
        ProviderGame game, GameStatus status, DateTimeOffset? stoppedAt, League league, DateTimeOffset now) => status switch
    {
        GameStatus.Upcoming => now >= game.StartTime - UpcomingWindow,
        GameStatus.Final => now < stoppedAt + FinalWindow,
        // A suspended game shows until the Final window has passed since the suspension.
        GameStatus.Disrupted when game.Status == ProviderStatus.Suspended =>
            now >= game.StartTime - UpcomingWindow && now < stoppedAt + FinalWindow,
        // Otherwise the original schedule's windows: from before the planned start until after the planned end.
        GameStatus.Disrupted =>
            now >= game.StartTime - UpcomingWindow && now < game.StartTime + league.PlannedLength + FinalWindow,
        _ => true,
    };

    private Game ToGame(ProviderGame game, GameStatus status, DateTimeOffset? endTime, League league, VenueLocation location)
    {
        return new Game(
            game.Id,
            league.Name,
            league.Sport.DisplayName(),
            game.StartTime,
            status,
            game.Status == ProviderStatus.Delayed,
            ToDisruption(game.Status),
            endTime,
            ToContest(game.Contest),
            ClockLine.For(game, league),
            game.Period,
            ClutchTime.For(game, league),
            HotGame.For(game, league),
            ToVenue(game.Venue, location) with { Photo = photos.PhotoFor(league.Key, game.Venue) },
            game.Broadcasters.Select(b => new GameBroadcaster(b.Name, b.Country, watchLinks.Find(b.Name))).ToList(),
            StreamLinks: [])
        {
            Note = game.Note,
            Attendance = game.Attendance,
            Odds = game.Odds is { } odds ? new GameOdds(odds.Line, odds.OverUnder, odds.Bookmaker) : null,
            Situation = status == GameStatus.Live && game.Situation is { } s
                ? new GameSituation(s.LastPlay, s.DownAndDistance, s.Possession, s.Balls, s.Strikes, s.Outs, s.OnFirst, s.OnSecond, s.OnThird)
                : null,
            LastScore = game.LastScore is { } play ? new ScoringPlay(play.Team, play.Text, ClockLine.When(play, league)) : null,
            KeyEvents = game.KeyEvents.Select(k => new KeyEvent(k.Kind, k.Team, k.Player, k.Clock)).ToList(),
            TopEvent = _topEvents.Contains(game.Id),
            Scoreline = Scoreline.For(game, league),
        };
    }

    private static GameVenue ToVenue(ProviderVenue? venue, VenueLocation location)
    {
        var (latitude, longitude) = (location.Location.Latitude, location.Location.Longitude);
        var timeZone = location.FoundBy == LocationSource.Nowhere
            ? null
            : TimeZoneLookup.GetTimeZone(latitude, longitude).Result;
        return new GameVenue(venue?.Name, venue?.City, RegionName.InFull(venue?.Region), venue?.Country, latitude, longitude, timeZone)
        {
            Court = venue?.Court,
        };
    }

    private static GameContest ToContest(ProviderContest contest) => contest switch
    {
        ProviderSides sides => new GameSides(ToTeam(sides.Home), ToTeam(sides.Away)),
        ProviderField field => new GameField(field.Entries
            .Select(entrant => new GameEntrant(entrant.Position, entrant.Name, entrant.ShortName, entrant.FlagUrl, ToParText(entrant.ToPar)))
            .ToList()),
        ProviderBouts card => new GameBouts(card.Bouts.Select(ToBout).ToList()),
        _ => throw new ArgumentOutOfRangeException(nameof(contest), contest, "No such contest"),
    };

    private static GameBout ToBout(ProviderBout bout) => new(
        bout.Id, ToBoutSide(bout.First), ToBoutSide(bout.Second), bout.WeightClass, bout.ScheduledRounds,
        ToStatus(bout.Status) ?? GameStatus.Upcoming, bout.Round, bout.Clock, ClockLine.MethodName(bout.Method));

    private static GameBoutSide ToBoutSide(ProviderBoutSide side) => new(side.Name, side.ShortName, side.FlagUrl, side.Record, side.Winner);

    private static GameTeam ToTeam(ProviderTeam team) =>
        new(team.Abbreviation, team.FullName, team.LogoUrl, ScoreText(team), team.Rank, team.Record);

    /// <summary>A score to par as golf writes it: "-12", "E" (level) or "+3".</summary>
    private static string? ToParText(int? toPar) => toPar switch
    {
        null => null,
        0 => "E",
        > 0 => $"+{toPar}",
        _ => toPar.Value.ToString(System.Globalization.CultureInfo.InvariantCulture),
    };

    /// <summary>The team's score as its sport writes it: "24", or in cricket "186/6", or "127" all out.</summary>
    private static string? ScoreText(ProviderTeam team) => (team.Score, team.Innings?.Wickets) switch
    {
        (null, _) => null,
        ({ } runs, { } wickets) => $"{runs}/{wickets}",
        ({ } score, _) => score.ToString(System.Globalization.CultureInfo.InvariantCulture),
    };
}
