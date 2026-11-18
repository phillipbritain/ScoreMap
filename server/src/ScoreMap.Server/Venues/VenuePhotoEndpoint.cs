using Microsoft.Extensions.Options;
using ScoreMap.Server.GameFeed;
using ScoreMap.Server.Games;

namespace ScoreMap.Server.Venues;

public static class VenuePhotoEndpoint
{
    /// <summary>How long a request waits for a venue's search before answering with no photo.</summary>
    public static readonly TimeSpan Wait = TimeSpan.FromSeconds(15);

    /// <summary>
    /// A venue's photo for a game the browser makes itself, the welcome tour's (ADR-0027), found and
    /// saved as a real game's is (<see cref="VenuePhotos"/>): <c>GET /api/venue-photo?league=NFL&amp;name=…&amp;city=…&amp;id=…</c>,
    /// the league by its configured name, and the venue's ESPN id (optional) as a real game's scoreboard gives it, so
    /// ESPN's photo is found as it is for a real game there. Answers with the photo, or 204 when the venue has none (or its
    /// search takes longer than <see cref="Wait"/>), and 404 for a league ScoreMap doesn't show.
    /// </summary>
    public static WebApplication MapVenuePhoto(this WebApplication app)
    {
        app.MapGet("/api/venue-photo", async (string league, string name, string? city, string? id,
            IOptions<List<League>> leagues, VenuePhotos photos, CancellationToken cancellationToken) =>
        {
            if (leagues.Value.FirstOrDefault(configured => configured.Name == league) is not { } known)
                return Results.NotFound($"ScoreMap doesn't show a league called \"{league}\"");
            using var timeout = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
            timeout.CancelAfter(Wait);
            try
            {
                var photo = await photos.PhotoForAsync(known.Key, new ProviderVenue(name, city, null, null, id), timeout.Token);
                return photo is null ? Results.NoContent() : Results.Ok(photo);
            }
            catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
            {
                // The search carries on, and its answer is saved for the next ask.
                return Results.NoContent();
            }
        });
        return app;
    }
}
