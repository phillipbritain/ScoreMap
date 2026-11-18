using Microsoft.Extensions.Options;
using ScoreMap.Server.GameFeed;
using ScoreMap.Server.Live;

namespace ScoreMap.Server.Games;

public static class GameDetailsEndpoint
{
    public static WebApplication MapGameDetails(this WebApplication app)
    {
        app.MapGet("/api/game-details", async (string id, string league, RunningGameBoard board,
            IOptions<List<League>> leagues, IGameFeedProvider feed, CancellationToken cancellationToken) =>
        {
            var configured = leagues.Value.FirstOrDefault(item => item.Name == league);
            if (configured is null || !board.Games.Any(game => game.Id == id && game.League == league))
                return Results.NotFound();

            var details = await feed.FetchGameDetailsAsync(configured, id, cancellationToken);
            return details is null ? Results.StatusCode(StatusCodes.Status502BadGateway) : Results.Ok(details);
        });
        return app;
    }
}
