using ScoreMap.Server.GameFeed;
using ScoreMap.Server.Venues;

namespace ScoreMap.Server.Tests.Support;

/// <summary>
/// A place-search lookup that knows the places the test adds and records every query. A query can
/// be made to fail as the real service does (<see cref="Fail"/>), or to run an action as it is asked
/// (<see cref="OnSearch"/>), e.g. to cancel the caller.
/// </summary>
public sealed class FakePlaceSearch : IPlaceSearch
{
    private readonly Dictionary<string, Coordinates> _places = new();
    private readonly Dictionary<string, Exception> _failures = new();
    private readonly Dictionary<string, Action> _onSearch = new();
    private readonly List<string> _queries = [];

    public IReadOnlyList<string> Queries
    {
        get { lock (_queries) return _queries.ToList(); }
    }

    /// <summary>Makes a query find a place, replacing any failure set for it.</summary>
    public void Add(string query, Coordinates location)
    {
        _places[query] = location;
        _failures.Remove(query);
    }

    /// <summary>Makes a query throw, as the real search does on an error status or a timeout.</summary>
    public void Fail(string query, Exception failure) => _failures[query] = failure;

    /// <summary>Runs an action when a query is asked, before answering it.</summary>
    public void OnSearch(string query, Action action) => _onSearch[query] = action;

    public Task<Coordinates?> SearchAsync(string query, CancellationToken cancellationToken)
    {
        lock (_queries)
            _queries.Add(query);
        if (_onSearch.TryGetValue(query, out var action))
            action();
        cancellationToken.ThrowIfCancellationRequested();
        if (_failures.TryGetValue(query, out var failure))
            throw failure;
        return Task.FromResult(_places.GetValueOrDefault(query));
    }
}
