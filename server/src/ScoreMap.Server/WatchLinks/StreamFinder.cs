using Microsoft.Extensions.Options;
using ScoreMap.Server.Games;

namespace ScoreMap.Server.WatchLinks;

/// <summary>
/// Finds unofficial links without delaying the running game board (ADR-0002: hobby v1 only).
/// Each resolved site page has one background fetch and parsed schedule shared across games and
/// viewers. Expired schedules are not served while refreshing; failures cache an empty schedule.
/// To disable, remove the configured sites. To remove before public launch, delete StreamFinder*.cs
/// and the AddStreamFinder line in Program.cs; NoStreamLinks then supplies the existing seam.
/// </summary>
public sealed class StreamFinder(
    IHttpClientFactory httpClients,
    IOptions<StreamFinderOptions> options,
    TimeProvider clock,
    IHostApplicationLifetime lifetime,
    ILogger<StreamFinder> logger) : IStreamLinkSource
{
    public const string HttpClientName = nameof(StreamFinder);
    public const int MaxLinks = 3;

    private readonly Lock _lock = new();
    private readonly Dictionary<(StreamSite Site, string Url), Search> _searches = new();

    /// <summary>Returns links from fresh schedules and starts any missing or expired fetches.</summary>
    public IReadOnlyList<StreamLink> LinksFor(Game game)
    {
        var settings = options.Value;
        if (game.Status is not (GameStatus.Upcoming or GameStatus.Live) || game.Contest is not GameSides sides)
            return [];

        lock (_lock)
        {
            var now = clock.GetUtcNow();
            foreach (var (key, old) in _searches.ToList())
                if (old.Running is null && now - old.Expires > TimeSpan.FromHours(1))
                    _searches.Remove(key);

            var links = new List<StreamLink>();
            foreach (var site in settings.Sites)
            {
                var address = site.SearchUrl
                    .Replace("{query}", Uri.EscapeDataString($"{sides.Away.FullName} {sides.Home.FullName}"))
                    .Replace("{away}", Uri.EscapeDataString(sides.Away.FullName))
                    .Replace("{home}", Uri.EscapeDataString(sides.Home.FullName));
                if (!_searches.TryGetValue((site, address), out var search))
                    _searches[(site, address)] = search = new Search();
                if (now >= search.Expires)
                {
                    if (search.Running is null)
                        search.Running = Task.Run(() => FetchAsync(site, address, search, settings));
                    continue;
                }
                if (StreamFinderSchedule.LinkFor(search.Listings, site, game, sides) is { } link)
                    links.Add(link);
            }
            return links.DistinctBy(link => link.Url).Take(MaxLinks).ToList();
        }
    }

    /// <summary>Completes when every fetch started so far has finished. For tests.</summary>
    public Task SearchesFinishedAsync()
    {
        lock (_lock)
            return Task.WhenAll(_searches.Values.Select(search => search.Running).OfType<Task>());
    }

    private async Task FetchAsync(StreamSite site, string address, Search search, StreamFinderOptions settings)
    {
        IReadOnlyList<StreamFinderSchedule.Listing> listings = [];
        try
        {
            using var timeout = CancellationTokenSource.CreateLinkedTokenSource(lifetime.ApplicationStopping);
            timeout.CancelAfter(TimeSpan.FromSeconds(settings.TimeoutSeconds));
            var pageUrl = new Uri(address);
            using var response = await httpClients.CreateClient(HttpClientName).GetAsync(pageUrl, timeout.Token);
            response.EnsureSuccessStatusCode();
            var page = await response.Content.ReadAsStringAsync(timeout.Token);
            listings = StreamFinderSchedule.Read(page, pageUrl, site);
        }
        catch (Exception error)
        {
            logger.LogWarning(error, "Stream site {Site} gave no schedule", site.Name);
        }
        finally
        {
            lock (_lock)
            {
                search.Listings = listings;
                search.Expires = clock.GetUtcNow() + TimeSpan.FromMinutes(settings.CacheMinutes);
                search.Running = null;
            }
        }
    }

    private sealed class Search
    {
        public IReadOnlyList<StreamFinderSchedule.Listing> Listings { get; set; } = [];
        public DateTimeOffset Expires { get; set; } = DateTimeOffset.MinValue;
        public Task? Running { get; set; }
    }
}
