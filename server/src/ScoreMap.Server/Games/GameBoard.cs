using Microsoft.Extensions.Options;
using ScoreMap.Server.GameFeed;

namespace ScoreMap.Server.Games;

/// <summary>
/// Turns provider data into ScoreMap's games. In the walking skeleton it simply
/// fetches every configured league on demand; statuses, pin windows and change
/// detection arrive in later tickets.
/// </summary>
public sealed class GameBoard(IGameFeedProvider feed, IOptions<List<League>> leagues)
{
    public async Task<IReadOnlyList<Game>> GetSnapshotAsync(CancellationToken cancellationToken)
    {
        var games = new List<Game>();
        foreach (var league in leagues.Value)
        {
            var scoreboard = await feed.FetchScoreboardAsync(league.Key, cancellationToken);
            games.AddRange(scoreboard.Select(game => ToGame(game, league)));
        }
        return games;
    }

    private static Game ToGame(ProviderGame game, League league)
    {
        var location = game.Venue?.Location ?? new Coordinates(0, 0);
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
