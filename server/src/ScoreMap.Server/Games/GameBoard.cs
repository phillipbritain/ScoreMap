using Microsoft.Extensions.Options;
using ScoreMap.Server.GameFeed;
using ScoreMap.Server.Venues;

namespace ScoreMap.Server.Games;

/// <summary>
/// Holds the current set of games and turns provider data into ScoreMap's games.
/// Each update of a league compares the new fetch with the last and reports what
/// changed. Not thread-safe: the poller serializes every call.
/// </summary>
public sealed class GameBoard(IGameFeedProvider feed, VenueLocator venues, IOptions<List<League>> leagues)
{
    private readonly Dictionary<string, IReadOnlyList<TrackedGame>> _games = new();

    public IReadOnlyList<League> Leagues => leagues.Value;

    /// <summary>Every game currently on the board, across all leagues.</summary>
    public IReadOnlyList<Game> Games => _games.Values.SelectMany(g => g).Select(g => g.Game).ToList();

    /// <summary>Fetches the league, replaces its games and returns what changed since the last fetch.</summary>
    public async Task<IReadOnlyList<GameChange>> UpdateLeagueAsync(League league, CancellationToken cancellationToken)
    {
        var scoreboard = await feed.FetchScoreboardAsync(league.Key, cancellationToken);
        var games = new List<TrackedGame>();
        foreach (var game in scoreboard)
        {
            var location = game.Venue is null ? null : await venues.LocateAsync(game.Venue, cancellationToken);
            games.Add(new TrackedGame(ToGame(game, league, location), game.Status));
        }

        var before = _games.GetValueOrDefault(league.Key, []);
        _games[league.Key] = games;
        return GameChanges.Between(before, games);
    }

    public bool HasLiveGames(League league) =>
        _games.TryGetValue(league.Key, out var games) && games.Any(g => g.IsLive);

    private static Game ToGame(ProviderGame game, League league, Coordinates? location)
    {
        // Until the venue fallbacks arrive, a venue that can't be found sits at 0,0.
        location ??= new Coordinates(0, 0);
        return new Game(
            game.Id,
            league.Name,
            league.Sport,
            game.StartTime,
            ToTeam(game.Home),
            ToTeam(game.Away),
            game.DisplayClock,
            game.Period,
            new GameVenue(game.Venue?.Name, game.Venue?.City, game.Venue?.Country, location.Latitude, location.Longitude));
    }

    private static GameTeam ToTeam(ProviderTeam team) =>
        new(team.Abbreviation, team.FullName, team.LogoUrl, team.Score);
}
