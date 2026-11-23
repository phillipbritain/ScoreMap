using System.Net;
using System.Net.Http.Json;
using ScoreMap.Server.GameFeed;
using ScoreMap.Server.Games;

namespace ScoreMap.Server.Venues;

/// <summary>
/// Finds a venue’s ESPN photo in the event’s league, then in another league that plays there
/// (see <see cref="VenueLeagueCatalog"/>). Each league prefers its interior photo, then its day photo.
/// </summary>
public sealed class VenuePhotoSearch(HttpClient http, VenueLeagueCatalog? leagues = null) : IVenuePhotoSearch
{
    /// <summary>Width asked for, in pixels: the event panel is 360 CSS pixels wide, so this stays sharp on high-density screens.</summary>
    public const int PhotoWidth = 720;

    private const string EspnCoreApi = "https://sports.core.api.espn.com/v2/sports/";
    private const string EspnImages = "https://a.espncdn.com/";

    public async Task<VenuePhoto?> SearchAsync(string leagueKey, ProviderVenue venue, CancellationToken cancellationToken)
    {
        if (await EspnPhotoAsync(leagueKey, venue.Id, cancellationToken) is { } own)
            return own;
        foreach (var (otherLeague, id) in (leagues ?? VenueLeagueCatalog.Empty).OtherLeagues(leagueKey, venue))
            if (await EspnPhotoAsync(otherLeague, id, cancellationToken) is { } other)
                return other;
        return null;
    }

    /// <summary>
    /// ESPN's photo of the venue, resized by ESPN's image combiner, or null when it has none. Its
    /// "interior" image (of the field, for football venues) is taken first, then its main "day" one,
    /// which for football venues is from outside and for arenas and ballparks is of the bowl.
    /// </summary>
    private async Task<VenuePhoto?> EspnPhotoAsync(string leagueKey, string? venueId, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(venueId))
            return null;
        // League keys are "sport/league", sometimes with a scoreboard query ("?groups=50") that the core API doesn't take.
        var (sport, league) = leagueKey.Split('?')[0].Split('/') is [var s, var l] ? (s, l) : (null, null);
        if (sport is null)
            return null;

        var details = await GetJsonAsync<EspnVenue>(
            $"{EspnCoreApi}{sport}/leagues/{league}/venues/{Uri.EscapeDataString(venueId)}", cancellationToken);
        // ESPN's images are photos of the bowl or field, so only their size is checked.
        var images = details?.Images?.Where(i => i.Href is not null && i.Rel is not null && !(i.Width < PhotoWidth)).ToList() ?? [];
        var best = images.FirstOrDefault(i => i.Rel!.Contains("interior"))
            ?? images.FirstOrDefault(i => i.Rel!.Contains("day"));
        if (best?.Href is not { } href)
            return null;
        return new VenuePhoto(
            href.StartsWith(EspnImages, StringComparison.OrdinalIgnoreCase)
                ? $"{EspnImages}combiner/i?img=/{href[EspnImages.Length..]}&w={PhotoWidth}"
                : href,
            Credit: null);
    }

    /// <summary>The JSON answer, or null for 404 Not Found. Any other failure throws.</summary>
    private async Task<T?> GetJsonAsync<T>(string url, CancellationToken cancellationToken)
    {
        using var request = new HttpRequestMessage(HttpMethod.Get, url);
        using var response = await http.SendAsync(request, cancellationToken);
        if (response.StatusCode == HttpStatusCode.NotFound)
            return default;
        response.EnsureSuccessStatusCode();
        return await response.Content.ReadFromJsonAsync<T>(cancellationToken);
    }

    // Response shapes (only the fields ScoreMap reads).
    private sealed record EspnVenue(List<EspnImage>? Images);
    private sealed record EspnImage(string? Href, int? Width, List<string>? Rel);
}
