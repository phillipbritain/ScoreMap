using System.Globalization;
using System.Net.Http.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Options;
using ScoreMap.Server.GameFeed;

namespace ScoreMap.Server.Venues;

/// <summary>
/// Place search through OpenStreetMap Nominatim, following its usage policy:
/// one request at a time, spaced by <see cref="NominatimOptions.MinRequestInterval"/>,
/// with a user agent naming ScoreMap. Callers save the answers (the venue locator and venue photos do).
/// </summary>
public sealed class NominatimPlaceSearch(HttpClient http, TimeProvider clock, IOptions<NominatimOptions> options) : IPlaceSearch
{
    public const string UserAgent = "ScoreMap/1.0 (+https://github.com/phillipbritain/ScoreMap)";

    private readonly SemaphoreSlim _gate = new(1, 1);
    private DateTimeOffset? _lastRequest;

    public async Task<Coordinates?> SearchAsync(string query, CancellationToken cancellationToken)
    {
        var best = await BestMatchAsync($"search?q={Uri.EscapeDataString(query)}&format=jsonv2&limit=1", cancellationToken);
        return best is null
            ? null
            : new Coordinates(
                double.Parse(best.Lat, CultureInfo.InvariantCulture),
                double.Parse(best.Lon, CultureInfo.InvariantCulture));
    }

    /// <summary>
    /// The Wikidata item (e.g. "Q163995") OpenStreetMap links the best match for a free-text query to,
    /// or null when nothing matches or the match has no link. Well-known stadiums usually have one.
    /// </summary>
    public async Task<string?> FindWikidataIdAsync(string query, CancellationToken cancellationToken)
    {
        var best = await BestMatchAsync($"search?q={Uri.EscapeDataString(query)}&format=jsonv2&limit=1&extratags=1", cancellationToken);
        return best?.ExtraTags?.GetValueOrDefault("wikidata");
    }

    private async Task<Hit?> BestMatchAsync(string path, CancellationToken cancellationToken)
    {
        await _gate.WaitAsync(cancellationToken);
        try
        {
            if (_lastRequest is { } last)
            {
                var wait = last + options.Value.MinRequestInterval - clock.GetUtcNow();
                if (wait > TimeSpan.Zero)
                    await Task.Delay(wait, clock, cancellationToken);
            }
            _lastRequest = clock.GetUtcNow();

            using var request = new HttpRequestMessage(HttpMethod.Get, path);
            request.Headers.UserAgent.ParseAdd(UserAgent);
            using var response = await http.SendAsync(request, cancellationToken);
            response.EnsureSuccessStatusCode();

            var hits = await response.Content.ReadFromJsonAsync<List<Hit>>(cancellationToken);
            return hits?.FirstOrDefault();
        }
        finally
        {
            _gate.Release();
        }
    }

    private sealed record Hit(
        [property: JsonPropertyName("lat")] string Lat,
        [property: JsonPropertyName("lon")] string Lon,
        [property: JsonPropertyName("extratags")] Dictionary<string, string>? ExtraTags = null);
}
