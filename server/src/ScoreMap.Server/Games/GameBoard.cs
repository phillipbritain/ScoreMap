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
/// and removed. Not thread-safe: the poller serializes every call.
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

    // Providers report no end or suspension time, so a game ends (or is suspended) when the board sees
    // it turn Final (or suspended). Keyed by game: the status it was last seen with, and for a stopped
    // game when it stopped.
    private readonly Dictionary<(string LeagueKey, string GameId), (ProviderStatus Status, DateTimeOffset? StoppedAt)> _sightings = new();

    public IReadOnlyList<League> Leagues => leagues.Value;

    /// <summary>Every game currently on the board, across all leagues.</summary>
    public IReadOnlyList<Game> Games => _games.Values.SelectMany(g => g).ToList();

    /// <summary>Fetches the league, replaces its games and returns what changed since the last update.</summary>
    public async Task<IReadOnlyList<GameChange>> UpdateLeagueAsync(League league, CancellationToken cancellationToken)
    {
        var scoreboard = await feed.FetchScoreboardAsync(league.Key, cancellationToken);
        var now = clock.GetUtcNow();
        ForgetGamesNoLongerReported(league.Key, scoreboard);
        var games = new List<Game>();
        foreach (var game in scoreboard)
        {
            if (ToStatus(game.Status) is not { } status)
                continue;
            var stoppedAt = RecordSighting(league, game, now);
            if (!IsInPinWindow(game, status, stoppedAt, league, now))
                continue;
            var endTime = status == GameStatus.Final ? stoppedAt : null;
            var location = await venues.LocateAsync(game.Venue, game.Home, cancellationToken);
            var added = ToGame(game, status, endTime, league, location);
            games.Add(added with { StreamLinks = streams.LinksFor(added) });
        }

        var before = _games.GetValueOrDefault(league.Key, []);
        _games[league.Key] = games;
        return GameChanges.Between(before, games);
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
            ToTeam(game.Home),
            ToTeam(game.Away),
            ClockLine.For(game, league),
            game.Period,
            ToVenue(game.Venue, location) with { Photo = photos.PhotoFor(league.Key, game.Venue) },
            game.Broadcasters.Select(b => new GameBroadcaster(b.Name, b.Country, watchLinks.Find(b.Name))).ToList(),
            StreamLinks: []);
    }

    private static GameVenue ToVenue(ProviderVenue? venue, VenueLocation location)
    {
        var (latitude, longitude) = (location.Location.Latitude, location.Location.Longitude);
        var timeZone = location.FoundBy == LocationSource.Nowhere
            ? null
            : TimeZoneLookup.GetTimeZone(latitude, longitude).Result;
        return new GameVenue(venue?.Name, venue?.City, venue?.Country, latitude, longitude, timeZone);
    }

    private static GameTeam ToTeam(ProviderTeam team) =>
        new(team.Abbreviation, team.FullName, team.LogoUrl, team.Score);
}
