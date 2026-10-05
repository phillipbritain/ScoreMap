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
    IGameFeedProvider feed, VenueLocator venues, OfficialWatchLinks watchLinks, IOptions<List<League>> leagues, TimeProvider clock)
{
    /// <summary>An Upcoming game gets its pin this long before its start.</summary>
    public static readonly TimeSpan UpcomingWindow = TimeSpan.FromHours(3);

    /// <summary>A Final game keeps its pin this long after its end.</summary>
    public static readonly TimeSpan FinalWindow = TimeSpan.FromHours(2);

    private readonly Dictionary<string, IReadOnlyList<Game>> _games = new();

    // Providers report no end time, so a game's end is when the board first sees it Final.
    private readonly Dictionary<(string LeagueKey, string GameId), DateTimeOffset> _endTimes = new();

    public IReadOnlyList<League> Leagues => leagues.Value;

    /// <summary>Every game currently on the board, across all leagues.</summary>
    public IReadOnlyList<Game> Games => _games.Values.SelectMany(g => g).ToList();

    /// <summary>Fetches the league, replaces its games and returns what changed since the last update.</summary>
    public async Task<IReadOnlyList<GameChange>> UpdateLeagueAsync(League league, CancellationToken cancellationToken)
    {
        var scoreboard = await feed.FetchScoreboardAsync(league.Key, cancellationToken);
        var now = clock.GetUtcNow();
        ForgetEndTimesOfGamesNoLongerReported(league.Key, scoreboard);
        var games = new List<Game>();
        foreach (var game in scoreboard)
        {
            if (ToStatus(game.Status) is not { } status)
                continue;
            var endTime = RecordEndTime(league.Key, game.Id, status, now);
            if (!IsInPinWindow(game.StartTime, status, endTime, now))
                continue;
            var location = await venues.LocateAsync(game.Venue, game.Home, cancellationToken);
            games.Add(ToGame(game, status, endTime, league, location));
        }

        var before = _games.GetValueOrDefault(league.Key, []);
        _games[league.Key] = games;
        return GameChanges.Between(before, games);
    }

    public bool HasLiveGames(League league) =>
        _games.TryGetValue(league.Key, out var games) && games.Any(g => g.Status == GameStatus.Live);

    /// <summary>
    /// Breaks (halftime, intermissions) arrive as in progress; delays stay Live too.
    /// Disrupted games (postponed, suspended, canceled) have no status yet, so no pin.
    /// </summary>
    private static GameStatus? ToStatus(ProviderStatus status) => status switch
    {
        ProviderStatus.Scheduled => GameStatus.Upcoming,
        ProviderStatus.InProgress or ProviderStatus.Delayed => GameStatus.Live,
        ProviderStatus.Final => GameStatus.Final,
        _ => null,
    };

    private DateTimeOffset? RecordEndTime(string leagueKey, string gameId, GameStatus status, DateTimeOffset now)
    {
        if (status == GameStatus.Final)
        {
            if (!_endTimes.TryGetValue((leagueKey, gameId), out var endTime))
                _endTimes[(leagueKey, gameId)] = endTime = now;
            return endTime;
        }
        _endTimes.Remove((leagueKey, gameId));
        return null;
    }

    private void ForgetEndTimesOfGamesNoLongerReported(string leagueKey, IReadOnlyList<ProviderGame> scoreboard)
    {
        var reported = scoreboard.Select(g => g.Id).ToHashSet();
        foreach (var key in _endTimes.Keys.ToList())
            if (key.LeagueKey == leagueKey && !reported.Contains(key.GameId))
                _endTimes.Remove(key);
    }

    private static bool IsInPinWindow(DateTimeOffset startTime, GameStatus status, DateTimeOffset? endTime, DateTimeOffset now) => status switch
    {
        GameStatus.Upcoming => now >= startTime - UpcomingWindow,
        GameStatus.Final => now < endTime + FinalWindow,
        _ => true,
    };

    private Game ToGame(ProviderGame game, GameStatus status, DateTimeOffset? endTime, League league, VenueLocation location)
    {
        return new Game(
            game.Id,
            league.Name,
            league.Sport,
            game.StartTime,
            status,
            game.Status == ProviderStatus.Delayed,
            endTime,
            ToTeam(game.Home),
            ToTeam(game.Away),
            ClockLine.For(game, league),
            game.Period,
            ToVenue(game.Venue, location),
            game.Broadcasters.Select(b => new GameBroadcaster(b.Name, b.Country, watchLinks.Find(b.Name))).ToList());
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
