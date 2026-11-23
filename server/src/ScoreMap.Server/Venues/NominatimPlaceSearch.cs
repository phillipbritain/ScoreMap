using System.Globalization;
using System.Net.Http.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Options;
using ScoreMap.Server.GameFeed;

namespace ScoreMap.Server.Venues;

/// <summary>
/// Place search through OpenStreetMap Nominatim, following its usage policy:
/// one request at a time, spaced by <see cref="NominatimOptions.MinRequestInterval"/>,
/// with a user agent naming ScoreMap. The venue locator saves the answers.
/// </summary>
public sealed class NominatimPlaceSearch(HttpClient http, TimeProvider clock, IOptions<NominatimOptions> options) : IPlaceSearch
{
    private const string UserAgent = "ScoreMap/1.0 (+https://github.com/phillipbritain/ScoreMap)";

    private readonly SemaphoreSlim _gate = new(1, 1);
    private DateTimeOffset? _lastRequest;

    public async Task<Coordinates?> SearchAsync(string query, CancellationToken cancellationToken)
    {
        var path = $"search?q={Uri.EscapeDataString(query)}&format=jsonv2&limit=1";
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
            return hits?.FirstOrDefault() is { } best
                ? new Coordinates(
                    double.Parse(best.Lat, CultureInfo.InvariantCulture),
                    double.Parse(best.Lon, CultureInfo.InvariantCulture))
                : null;
        }
        finally
        {
            _gate.Release();
        }
    }

    private sealed record Hit(
        [property: JsonPropertyName("lat")] string Lat,
        [property: JsonPropertyName("lon")] string Lon);
}
