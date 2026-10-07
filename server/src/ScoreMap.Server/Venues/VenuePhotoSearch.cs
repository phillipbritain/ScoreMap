using System.Net;
using System.Net.Http.Json;
using System.Text.Json.Serialization;
using System.Text.RegularExpressions;
using ScoreMap.Server.GameFeed;
using ScoreMap.Server.Games;

namespace ScoreMap.Server.Venues;

/// <summary>
/// Finds a venue's photo, trying in order: ESPN's own main ("day") photo of the venue from its core
/// API, which covers most US venues; then the image Wikidata gives for the venue (property P18),
/// found through the Wikidata item OpenStreetMap links the venue to, served by Wikimedia Commons with
/// its author and licence. Both are asked for a photo about twice the game panel's width.
/// </summary>
public sealed partial class VenuePhotoSearch(HttpClient http, NominatimPlaceSearch places) : IVenuePhotoSearch
{
    /// <summary>Width asked for, in pixels: the game panel is 360 CSS pixels wide, so this stays sharp on high-density screens.</summary>
    public const int PhotoWidth = 720;

    private const string EspnCoreApi = "https://sports.core.api.espn.com/v2/sports/";
    private const string EspnImages = "https://a.espncdn.com/";
    private const string WikidataApi = "https://www.wikidata.org/w/api.php";
    private const string CommonsApi = "https://commons.wikimedia.org/w/api.php";

    public async Task<VenuePhoto?> SearchAsync(string leagueKey, ProviderVenue venue, CancellationToken cancellationToken) =>
        await EspnPhotoAsync(leagueKey, venue, cancellationToken) ?? await CommonsPhotoAsync(venue, cancellationToken);

    /// <summary>
    /// ESPN's main photo of the venue, resized by ESPN's image combiner, or null when it has none. That's
    /// its "day" image: for football venues ESPN also has an "interior" one, which is left out, and the
    /// day image is from outside; for arenas and ballparks the day image is the only one, of the bowl.
    /// </summary>
    private async Task<VenuePhoto?> EspnPhotoAsync(string leagueKey, ProviderVenue venue, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(venue.Id))
            return null;
        // League keys are "sport/league", sometimes with a scoreboard query ("?groups=50") that the core API doesn't take.
        var (sport, league) = leagueKey.Split('?')[0].Split('/') is [var s, var l] ? (s, l) : (null, null);
        if (sport is null)
            return null;

        var details = await GetJsonAsync<EspnVenue>(
            $"{EspnCoreApi}{sport}/leagues/{league}/venues/{Uri.EscapeDataString(venue.Id)}", cancellationToken);
        var main = details?.Images?.FirstOrDefault(i =>
            i.Href is not null && i.Rel is { } rel && rel.Contains("day") && !rel.Contains("interior"));
        if (main?.Href is not { } href)
            return null;
        return new VenuePhoto(
            href.StartsWith(EspnImages, StringComparison.OrdinalIgnoreCase)
                ? $"{EspnImages}combiner/i?img=/{href[EspnImages.Length..]}&w={PhotoWidth}"
                : href,
            Credit: null);
    }

    /// <summary>The venue's Wikidata image from Wikimedia Commons with its credit, or null when it has none.</summary>
    private async Task<VenuePhoto?> CommonsPhotoAsync(ProviderVenue venue, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(venue.Name))
            return null;
        var query = string.IsNullOrWhiteSpace(venue.City) ? venue.Name : $"{venue.Name}, {venue.City}";
        if (await places.FindWikidataIdAsync(query, cancellationToken) is not { } item)
            return null;

        var claims = await GetJsonAsync<WikidataClaims>(
            $"{WikidataApi}?action=wbgetclaims&entity={Uri.EscapeDataString(item)}&property=P18&format=json", cancellationToken);
        if (claims?.Claims?.GetValueOrDefault("P18")?.FirstOrDefault()?.MainSnak?.DataValue?.Value is not { } file)
            return null;

        var info = await GetJsonAsync<CommonsQuery>(
            $"{CommonsApi}?action=query&titles={Uri.EscapeDataString($"File:{file}")}&prop=imageinfo"
            + $"&iiprop=url%7Cextmetadata&iiurlwidth={PhotoWidth}"
            + "&iiextmetadatafilter=Artist%7CLicenseShortName%7CLicenseUrl&format=json&formatversion=2",
            cancellationToken);
        var image = info?.Query?.Pages?.FirstOrDefault()?.ImageInfo?.FirstOrDefault();
        if (image?.ThumbUrl is not { } url || image.DescriptionUrl is not { } page)
            return null;
        var metadata = image.ExtMetadata;
        return new VenuePhoto(url, new PhotoCredit(
            PlainText(metadata?.GetValueOrDefault("Artist")?.Value) ?? "Unknown author",
            PlainText(metadata?.GetValueOrDefault("LicenseShortName")?.Value) ?? "See source",
            metadata?.GetValueOrDefault("LicenseUrl")?.Value,
            page));
    }

    /// <summary>The JSON answer, or null for 404 Not Found. Any other failure throws.</summary>
    private async Task<T?> GetJsonAsync<T>(string url, CancellationToken cancellationToken)
    {
        using var request = new HttpRequestMessage(HttpMethod.Get, url);
        // Wikimedia's APIs ask for a user agent that says who is calling.
        request.Headers.UserAgent.ParseAdd(NominatimPlaceSearch.UserAgent);
        using var response = await http.SendAsync(request, cancellationToken);
        if (response.StatusCode == HttpStatusCode.NotFound)
            return default;
        response.EnsureSuccessStatusCode();
        return await response.Content.ReadFromJsonAsync<T>(cancellationToken);
    }

    /// <summary>Commons metadata is HTML (an author is often a link to their user page): its text, or null when empty.</summary>
    private static string? PlainText(string? html)
    {
        if (html is null)
            return null;
        var text = WebUtility.HtmlDecode(Tags().Replace(html, " "));
        text = Whitespace().Replace(text, " ").Trim();
        return text.Length == 0 ? null : text;
    }

    [GeneratedRegex("<[^>]*>")]
    private static partial Regex Tags();

    [GeneratedRegex(@"\s+")]
    private static partial Regex Whitespace();

    // Response shapes (only the fields ScoreMap reads).
    private sealed record EspnVenue(List<EspnImage>? Images);
    private sealed record EspnImage(string? Href, List<string>? Rel);
    private sealed record WikidataClaims(Dictionary<string, List<Claim>>? Claims);
    private sealed record Claim([property: JsonPropertyName("mainsnak")] Snak? MainSnak);
    private sealed record Snak([property: JsonPropertyName("datavalue")] DataValue? DataValue);
    /// <summary>For P18 (the only property asked for), the image's file name on Commons.</summary>
    private sealed record DataValue(string? Value);
    private sealed record CommonsQuery(CommonsPages? Query);
    private sealed record CommonsPages(List<CommonsPage>? Pages);
    private sealed record CommonsPage([property: JsonPropertyName("imageinfo")] List<ImageInfo>? ImageInfo);
    private sealed record ImageInfo(
        [property: JsonPropertyName("thumburl")] string? ThumbUrl,
        [property: JsonPropertyName("descriptionurl")] string? DescriptionUrl,
        [property: JsonPropertyName("extmetadata")] Dictionary<string, MetadataValue>? ExtMetadata);
    private sealed record MetadataValue(string? Value);
}
