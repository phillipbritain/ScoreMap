using ScoreMap.Server.GameFeed;
using ScoreMap.Server.Venues;

namespace ScoreMap.Server.Tests.Support;

/// <summary>A place-search lookup that knows the places the test adds and records every query.</summary>
public sealed class FakePlaceSearch : IPlaceSearch
{
    private readonly Dictionary<string, Coordinates> _places = new();
    private readonly List<string> _queries = [];

    public IReadOnlyList<string> Queries
    {
        get { lock (_queries) return _queries.ToList(); }
    }

    public void Add(string query, Coordinates location) => _places[query] = location;

    public Task<Coordinates?> SearchAsync(string query, CancellationToken cancellationToken)
    {
        lock (_queries)
            _queries.Add(query);
        return Task.FromResult(_places.GetValueOrDefault(query));
    }
}
