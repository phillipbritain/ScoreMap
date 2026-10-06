using ScoreMap.Server.GameFeed;

namespace ScoreMap.Server.Venues;

/// <summary>
/// An outside place-search (geocoding) service: free text in, a position out.
/// Callers must not repeat queries; the venue locator saves every answer.
/// </summary>
public interface IPlaceSearch
{
    /// <summary>Finds the best match for a free-text query, or null when nothing matches.</summary>
    Task<Coordinates?> SearchAsync(string query, CancellationToken cancellationToken);
}
