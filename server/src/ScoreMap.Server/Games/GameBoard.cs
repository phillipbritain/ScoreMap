using System.Collections.Concurrent;
using Microsoft.Extensions.Options;
using ScoreMap.Server.GameFeed;
using ScoreMap.Server.Venues;

namespace ScoreMap.Server.Games;

/// <summary>
/// Turns provider data plus the current time into ScoreMap's games: it maps provider
/// statuses to ScoreMap's and keeps only games inside their pin windows. It still
/// fetches every configured league on demand; change detection arrives in a later ticket.
/// </summary>
public sealed class GameBoard(IGameFeedProvider feed, VenueLocator venues, IOptions<List<League>> leagues, TimeProvider clock)
{
    /// <summary>An Upcoming game gets its pin this long before its start.</summary>
    public static readonly TimeSpan UpcomingWindow = TimeSpan.FromHours(3);

    /// <summary>A Final game keeps its pin this long after its end.</summary>
    public static readonly TimeSpan FinalWindow = TimeSpan.FromHours(2);

    // Providers report no end time, so a game's end is when the board first sees it Final.
    private readonly ConcurrentDictionary<(string LeagueKey, string GameId), DateTimeOffset> _endTimes = new();

    public async Task<IReadOnlyList<Game>> GetSnapshotAsync(CancellationToken cancellationToken)
    {
        var games = new List<Game>();
        foreach (var league in leagues.Value)
        {
            var scoreboard = await feed.FetchScoreboardAsync(league.Key, cancellationToken);
            var now = clock.GetUtcNow();
            ForgetEndTimesOfGamesNoLongerReported(league.Key, scoreboard);
            foreach (var game in scoreboard)
            {
                if (ToStatus(game.Status) is not { } status)
                    continue;
                var endTime = RecordEndTime(league.Key, game.Id, status, now);
                if (!IsInPinWindow(game.StartTime, status, endTime, now))
                    continue;
                var location = game.Venue is null ? null : await venues.LocateAsync(game.Venue, cancellationToken);
                games.Add(ToGame(game, status, endTime, league, location));
            }
        }
        return games;
    }

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
            return _endTimes.GetOrAdd((leagueKey, gameId), now);
        _endTimes.TryRemove((leagueKey, gameId), out _);
        return null;
    }

    private void ForgetEndTimesOfGamesNoLongerReported(string leagueKey, IReadOnlyList<ProviderGame> scoreboard)
    {
        var reported = scoreboard.Select(g => g.Id).ToHashSet();
        foreach (var key in _endTimes.Keys)
            if (key.LeagueKey == leagueKey && !reported.Contains(key.GameId))
                _endTimes.TryRemove(key, out _);
    }

    private static bool IsInPinWindow(DateTimeOffset startTime, GameStatus status, DateTimeOffset? endTime, DateTimeOffset now) => status switch
    {
        GameStatus.Upcoming => now >= startTime - UpcomingWindow,
        GameStatus.Final => now < endTime + FinalWindow,
        _ => true,
    };

    private static Game ToGame(ProviderGame game, GameStatus status, DateTimeOffset? endTime, League league, Coordinates? location)
    {
        // Until the venue fallbacks arrive, a venue that can't be found sits at 0,0.
        location ??= new Coordinates(0, 0);
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
            game.DisplayClock,
            game.Period,
            new GameVenue(game.Venue?.Name, game.Venue?.City, game.Venue?.Country, location.Latitude, location.Longitude));
    }

    private static GameTeam ToTeam(ProviderTeam team) =>
        new(team.Abbreviation, team.FullName, team.LogoUrl, team.Score);
}
