using ScoreMap.Server.GameFeed;
using ScoreMap.Server.Games;
using ScoreMap.Server.Venues;

namespace ScoreMap.Server.Tests.Support;

/// <summary>A venue photo search that knows the photos the test adds, by venue name, and records every search.</summary>
public sealed class FakeVenuePhotoSearch : IVenuePhotoSearch
{
    private readonly Dictionary<string, VenuePhoto> _photos = new();
    private readonly HashSet<string> _failing = [];
    private readonly List<string> _searches = [];

    /// <summary>The names of the venues searched for, in order.</summary>
    public IReadOnlyList<string> Searches
    {
        get { lock (_searches) return _searches.ToList(); }
    }

    public void Add(string venueName, VenuePhoto photo)
    {
        lock (_searches)
            _photos[venueName] = photo;
    }

    /// <summary>Makes searches for the venue throw, as if the photo sources were down, until <see cref="Recover"/>.</summary>
    public void Fail(string venueName)
    {
        lock (_searches)
            _failing.Add(venueName);
    }

    public void Recover(string venueName)
    {
        lock (_searches)
            _failing.Remove(venueName);
    }

    public Task<VenuePhoto?> SearchAsync(string leagueKey, ProviderVenue venue, CancellationToken cancellationToken)
    {
        lock (_searches)
        {
            _searches.Add(venue.Name ?? "");
            if (_failing.Contains(venue.Name ?? ""))
                return Task.FromException<VenuePhoto?>(new HttpRequestException("photo sources are down"));
            return Task.FromResult(_photos.GetValueOrDefault(venue.Name ?? ""));
        }
    }
}
