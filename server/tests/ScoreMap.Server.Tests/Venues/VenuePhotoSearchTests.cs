using Microsoft.Extensions.Options;
using Microsoft.Extensions.Time.Testing;
using ScoreMap.Server.GameFeed;
using ScoreMap.Server.Games;
using ScoreMap.Server.Tests.Support;
using ScoreMap.Server.Venues;
using static ScoreMap.Server.Tests.Support.StubHttpHandler;

namespace ScoreMap.Server.Tests.Venues;

/// <summary>
/// The venue photo search, against canned answers shaped like ESPN's core API, Nominatim,
/// Wikidata and Wikimedia Commons (spot-checked on 2026-10-06).
/// </summary>
public class VenuePhotoSearchTests
{
    private static readonly ProviderVenue BankOfAmerica = new("Bank of America Stadium", "Charlotte", "NC", "USA", "3628");
    private static readonly ProviderVenue Emirates = new("Emirates Stadium", "London", null, "England", "2267");

    private const string EspnBankOfAmerica = "https://sports.core.api.espn.com/v2/sports/football/leagues/nfl/venues/3628";
    private const string EspnEmirates = "https://sports.core.api.espn.com/v2/sports/soccer/leagues/eng.1/venues/2267";
    private const string Nominatim = "https://nominatim.test/search?q=Emirates%20Stadium%2C%20London&";
    private const string WikidataClaims = "https://www.wikidata.org/w/api.php?action=wbgetclaims&entity=Q163995&property=P18&format=json";
    private const string CommonsInfo = "https://commons.wikimedia.org/w/api.php?action=query&titles=File%3ALondon%20Emirates%20Stadium%20arsenal.jpg&";

    private const string BankOfAmericaImages = """
        {"id":"3628","fullName":"Bank of America Stadium","images":[
          {"href":"https://a.espncdn.com/i/venues/nfl/day/interior/3628.jpg","width":2000,"height":1125,"rel":["full","day","interior"]},
          {"href":"https://a.espncdn.com/i/venues/nfl/day/3628.jpg","width":2000,"height":1125,"rel":["full","day"]}]}
        """;

    private const string NoImages = """{"id":"2267","fullName":"Emirates Stadium","images":[]}""";

    private const string EmiratesPlace = """
        [{"lat":"51.5550404","lon":"-0.1083997","extratags":{"sport":"soccer","wikidata":"Q163995"}}]
        """;

    private const string EmiratesImageClaim = """
        {"claims":{"P18":[{"mainsnak":{"snaktype":"value","property":"P18",
          "datavalue":{"value":"London Emirates Stadium arsenal.jpg","type":"string"}},"type":"statement","rank":"normal"}]}}
        """;

    private const string EmiratesImageInfo = """
        {"batchcomplete":true,"query":{"pages":[{"pageid":124370055,"ns":6,"title":"File:London Emirates Stadium arsenal.jpg",
          "imageinfo":[{"thumburl":"https://upload.wikimedia.org/wikipedia/commons/thumb/2/29/London_Emirates_Stadium_arsenal.jpg/960px-London_Emirates_Stadium_arsenal.jpg",
            "thumbwidth":720,"thumbheight":539,
            "url":"https://upload.wikimedia.org/wikipedia/commons/2/29/London_Emirates_Stadium_arsenal.jpg",
            "descriptionurl":"https://commons.wikimedia.org/wiki/File:London_Emirates_Stadium_arsenal.jpg",
            "extmetadata":{
              "Artist":{"value":"<a href=\"//commons.wikimedia.org/wiki/User:Arne_mueseler\" title=\"User:Arne mueseler\">Arne Müseler</a> &amp; friends","source":"commons-desc-page"},
              "LicenseShortName":{"value":"CC BY-SA 3.0 de","source":"commons-desc-page"},
              "LicenseUrl":{"value":"https://creativecommons.org/licenses/by-sa/3.0/de/deed.en","source":"commons-desc-page"}}}]}]}}
        """;

    private static readonly VenuePhoto EmiratesPhoto = new(
        "https://upload.wikimedia.org/wikipedia/commons/thumb/2/29/London_Emirates_Stadium_arsenal.jpg/960px-London_Emirates_Stadium_arsenal.jpg",
        new PhotoCredit("Arne Müseler & friends", "CC BY-SA 3.0 de",
            "https://creativecommons.org/licenses/by-sa/3.0/de/deed.en",
            "https://commons.wikimedia.org/wiki/File:London_Emirates_Stadium_arsenal.jpg"));

    private static VenuePhotoSearch Search(StubHttpHandler handler) => new(
        new HttpClient(handler),
        new NominatimPlaceSearch(
            new HttpClient(handler) { BaseAddress = new Uri("https://nominatim.test/") },
            new FakeTimeProvider(),
            Options.Create(new NominatimOptions())));

    [Fact]
    public async Task Uses_espns_main_photo_not_its_interior_one_resized_for_the_panel_without_asking_anyone_else()
    {
        var handler = Serving((EspnBankOfAmerica, BankOfAmericaImages));

        var photo = await Search(handler).SearchAsync("football/nfl", BankOfAmerica, CancellationToken.None);

        Assert.Equal(new VenuePhoto("https://a.espncdn.com/combiner/i?img=/i/venues/nfl/day/3628.jpg&w=720", null), photo);
        Assert.Single(handler.Requests);
    }

    [Fact]
    public async Task Asks_espn_for_the_venue_in_the_games_sport_and_league()
    {
        var handler = Serving(("https://nominatim.test/", "[]"));
        var venue = new ProviderVenue("Palazzo dello Sport", "Rome", "Italy", null, "3282");

        await Search(handler).SearchAsync("basketball/mens-college-basketball?groups=50", venue, CancellationToken.None);

        Assert.Equal("https://sports.core.api.espn.com/v2/sports/basketball/leagues/mens-college-basketball/venues/3282",
            handler.Requests[0].RequestUri!.AbsoluteUri);
    }

    [Fact]
    public async Task Falls_back_to_the_wikidata_image_with_its_commons_credit_when_espn_has_no_photo()
    {
        var handler = Serving((EspnEmirates, NoImages), (Nominatim, EmiratesPlace), (WikidataClaims, EmiratesImageClaim),
            (CommonsInfo, EmiratesImageInfo));

        var photo = await Search(handler).SearchAsync("soccer/eng.1", Emirates, CancellationToken.None);

        Assert.Equal(EmiratesPhoto, photo);
        Assert.All(handler.Requests, r => Assert.Contains("ScoreMap", r.Headers.UserAgent.ToString()));
    }

    [Fact]
    public async Task Falls_back_to_wikidata_when_espn_doesnt_know_the_venue_or_the_venue_has_no_id()
    {
        var handler = Serving((Nominatim, EmiratesPlace), (WikidataClaims, EmiratesImageClaim), (CommonsInfo, EmiratesImageInfo));

        Assert.Equal(EmiratesPhoto, await Search(handler).SearchAsync("soccer/eng.1", Emirates, CancellationToken.None));
        Assert.Equal(EmiratesPhoto, await Search(handler).SearchAsync("soccer/eng.1", Emirates with { Id = null }, CancellationToken.None));
    }

    [Theory]
    [InlineData("[]", EmiratesImageClaim)]
    [InlineData("""[{"lat":"51.5","lon":"-0.1","extratags":{}}]""", EmiratesImageClaim)]
    [InlineData(EmiratesPlace, """{"claims":{}}""")]
    public async Task Finds_no_photo_when_the_venue_has_no_wikidata_item_or_the_item_has_no_image(string place, string claims)
    {
        var handler = Serving((EspnEmirates, NoImages), (Nominatim, place), (WikidataClaims, claims), (CommonsInfo, EmiratesImageInfo));

        Assert.Null(await Search(handler).SearchAsync("soccer/eng.1", Emirates, CancellationToken.None));
    }

    [Fact]
    public async Task A_failing_source_fails_the_search_rather_than_finding_no_photo()
    {
        var handler = Serving((EspnEmirates, NoImages), (Nominatim, EmiratesPlace), (WikidataClaims, ServerError));

        await Assert.ThrowsAsync<HttpRequestException>(() =>
            Search(handler).SearchAsync("soccer/eng.1", Emirates, CancellationToken.None));
    }
}
