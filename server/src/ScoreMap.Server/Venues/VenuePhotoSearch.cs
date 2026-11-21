using System.Net;
using System.Net.Http.Json;
using System.Text.Json.Serialization;
using System.Text.RegularExpressions;
using ScoreMap.Server.GameFeed;
using ScoreMap.Server.Games;

namespace ScoreMap.Server.Venues;

/// <summary>
/// Finds a venue's photo, preferring one from inside, trying in order: ESPN's own "interior" photo of
/// the venue from its core API, then its main ("day") one, which cover most US venues, in the game's
/// league; then ESPN's photo of the venue in another league that plays there (from
/// <see cref="VenueLeagueCatalog"/>: ESPN gives each league its own id for a venue, and its own photos); then the images Wikidata gives for the venue
/// (its interior images, P5775, then its main ones, P18), found through the Wikidata item OpenStreetMap links the venue to, served by
/// Wikimedia Commons with their author and license. Both are asked for a photo about twice the event panel's width. Only a good photo
/// is taken (see <see cref="IsGoodPhoto"/>): with none, the venue has no photo rather than a poor one.
/// </summary>
public sealed partial class VenuePhotoSearch(HttpClient http, NominatimPlaceSearch places, VenueLeagueCatalog? leagues = null) : IVenuePhotoSearch
{
    /// <summary>Width asked for, in pixels: the event panel is 360 CSS pixels wide, so this stays sharp on high-density screens.</summary>
    public const int PhotoWidth = 720;

    private const string EspnCoreApi = "https://sports.core.api.espn.com/v2/sports/";
    private const string EspnImages = "https://a.espncdn.com/";
    private const string WikidataApi = "https://www.wikidata.org/w/api.php";
    private const string CommonsApi = "https://commons.wikimedia.org/w/api.php";

    /// <summary>Wikidata's "image" property, the item's main image.</summary>
    private const string Image = "P18";

    /// <summary>Wikidata's "interior image" property.</summary>
    private const string InteriorImage = "P5775";

    public async Task<VenuePhoto?> SearchAsync(string leagueKey, ProviderVenue venue, CancellationToken cancellationToken)
    {
        if (await EspnPhotoAsync(leagueKey, venue.Id, cancellationToken) is { } own)
            return own;
        foreach (var (otherLeague, id) in (leagues ?? VenueLeagueCatalog.Empty).OtherLeagues(leagueKey, venue))
            if (await EspnPhotoAsync(otherLeague, id, cancellationToken) is { } other)
                return other;
        return await CommonsPhotoAsync(venue, cancellationToken);
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

    /// <summary>
    /// The venue's best Wikidata image from Wikimedia Commons with its credit, or null when none is good enough
    /// (see <see cref="IsGoodPhoto"/>). Its images from inside (property P5775) are tried first, then its main ones (P18).
    /// </summary>
    private async Task<VenuePhoto?> CommonsPhotoAsync(ProviderVenue venue, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(venue.Name))
            return null;
        var query = string.IsNullOrWhiteSpace(venue.City) ? venue.Name : $"{venue.Name}, {venue.City}";
        if (await places.FindWikidataIdAsync(query, cancellationToken) is not { } item)
            return null;

        foreach (var property in (string[])[InteriorImage, Image])
        {
            foreach (var file in await WikidataFilesAsync(item, property, cancellationToken))
            {
                if (await CommonsImageAsync(file, cancellationToken) is { } image && IsGoodPhoto(file, image)
                    && Photo(image) is { } photo)
                    return photo;
            }
        }
        return null;
    }

    /// <summary>The Commons file names the Wikidata item gives for the property, in Wikidata's order.</summary>
    private async Task<IEnumerable<string>> WikidataFilesAsync(string item, string property, CancellationToken cancellationToken)
    {
        var claims = await GetJsonAsync<WikidataClaims>(
            $"{WikidataApi}?action=wbgetclaims&entity={Uri.EscapeDataString(item)}&property={property}&format=json", cancellationToken);
        return claims?.Claims?.GetValueOrDefault(property)?
            .Select(claim => claim.MainSnak?.DataValue?.Value)
            .OfType<string>() ?? [];
    }

    private async Task<ImageInfo?> CommonsImageAsync(string file, CancellationToken cancellationToken)
    {
        var info = await GetJsonAsync<CommonsQuery>(
            $"{CommonsApi}?action=query&titles={Uri.EscapeDataString($"File:{file}")}&prop=imageinfo"
            + $"&iiprop=url%7Csize%7Cmime%7Cextmetadata&iiurlwidth={PhotoWidth}"
            + "&iiextmetadatafilter=Artist%7CLicenseShortName%7CLicenseUrl%7CCategories%7CImageDescription%7CObjectName"
            + "&format=json&formatversion=2",
            cancellationToken);
        return info?.Query?.Pages?.FirstOrDefault()?.ImageInfo?.FirstOrDefault();
    }

    private static VenuePhoto? Photo(ImageInfo image)
    {
        if (image.ThumbUrl is not { } url || image.DescriptionUrl is not { } page)
            return null;
        var metadata = image.ExtMetadata;
        return new VenuePhoto(url, new PhotoCredit(
            PlainText(metadata?.GetValueOrDefault("Artist")?.Value) ?? "Unknown author",
            PlainText(metadata?.GetValueOrDefault("LicenseShortName")?.Value) ?? "See source",
            metadata?.GetValueOrDefault("LicenseUrl")?.Value,
            page));
    }

    /// <summary>
    /// Whether a Commons image is good enough for the event panel: a photo (not a drawing) at least
    /// <see cref="PhotoWidth"/> pixels wide, so it isn't blown up, and not taken from the air: no satellite,
    /// aerial or drone view in its file name, description or categories.
    /// </summary>
    private static bool IsGoodPhoto(string file, ImageInfo image)
    {
        if (image.Width < PhotoWidth || image.Mime is "image/svg+xml" or "image/gif")
            return false;
        var metadata = image.ExtMetadata;
        string?[] words = [file, metadata?.GetValueOrDefault("ObjectName")?.Value,
            metadata?.GetValueOrDefault("ImageDescription")?.Value, metadata?.GetValueOrDefault("Categories")?.Value];
        return !words.Any(text => text is not null && FromTheAir().IsMatch(text));
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

    /// <summary>
    /// Words naming a view from the air, as Commons names and files them ("Satellite pictures of structures", "Aerial photographs of …").
    /// Not "from above" or "bird's-eye": Commons uses those for views from high up, such as a stadium's upper deck.
    /// </summary>
    [GeneratedRegex(@"satellite|aerial|world[ _]wind|google[ _]earth|orthophoto|drone|from[ _]the[ _]air", RegexOptions.IgnoreCase)]
    private static partial Regex FromTheAir();

    [GeneratedRegex("<[^>]*>")]
    private static partial Regex Tags();

    [GeneratedRegex(@"\s+")]
    private static partial Regex Whitespace();

    // Response shapes (only the fields ScoreMap reads).
    private sealed record EspnVenue(List<EspnImage>? Images);
    private sealed record EspnImage(string? Href, int? Width, List<string>? Rel);
    private sealed record WikidataClaims(Dictionary<string, List<Claim>>? Claims);
    private sealed record Claim([property: JsonPropertyName("mainsnak")] Snak? MainSnak);
    private sealed record Snak([property: JsonPropertyName("datavalue")] DataValue? DataValue);
    /// <summary>For the image properties (the only ones asked for), the image's file name on Commons.</summary>
    private sealed record DataValue(string? Value);
    private sealed record CommonsQuery(CommonsPages? Query);
    private sealed record CommonsPages(List<CommonsPage>? Pages);
    private sealed record CommonsPage([property: JsonPropertyName("imageinfo")] List<ImageInfo>? ImageInfo);
    private sealed record ImageInfo(
        int Width,
        string? Mime,
        [property: JsonPropertyName("thumburl")] string? ThumbUrl,
        [property: JsonPropertyName("descriptionurl")] string? DescriptionUrl,
        [property: JsonPropertyName("extmetadata")] Dictionary<string, MetadataValue>? ExtMetadata);
    private sealed record MetadataValue(string? Value);
}
