using ScoreMap.Server.GameFeed;
using ScoreMap.Server.Games;

namespace ScoreMap.Server.Venues;

/// <summary>
/// Photo sources outside ScoreMap: a venue in, a photo of it out. Slow (several requests per venue), so
/// callers must not repeat searches; <see cref="VenuePhotos"/> saves every answer.
/// </summary>
public interface IVenuePhotoSearch
{
    /// <summary>
    /// Finds a photo of the venue, or null when no source has one. Throws when a source fails,
    /// so that a failure isn't mistaken for (and saved as) the venue having no photo.
    /// </summary>
    Task<VenuePhoto?> SearchAsync(string leagueKey, ProviderVenue venue, CancellationToken cancellationToken);
}
