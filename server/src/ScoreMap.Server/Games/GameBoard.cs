using Microsoft.Extensions.Options;
using ScoreMap.Server.GameFeed;
using ScoreMap.Server.Venues;

namespace ScoreMap.Server.Games;

/// <summary>
/// Turns provider data into ScoreMap's games. In the walking skeleton it simply
/// fetches every configured league on demand; statuses, pin windows and change
/// detection arrive in later tickets.
/// </summary>
public sealed class GameBoard(IGameFeedProvider feed, VenueLocator venues, IOptions<List<League>> leagues)
{
    public async Task<IReadOnlyList<Game>> GetSnapshotAsync(CancellationToken cancellationToken)
    {
        var games = new List<Game>();
        foreach (var league in leagues.Value)
        {
            var scoreboard = await feed.FetchScoreboardAsync(league.Key, cancellationToken);
            foreach (var game in scoreboard)
            {
                var location = game.Venue is null ? null : await venues.LocateAsync(game.Venue, cancellationToken);
                games.Add(ToGame(game, league, location));
            }
        }
        return games;
    }

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
