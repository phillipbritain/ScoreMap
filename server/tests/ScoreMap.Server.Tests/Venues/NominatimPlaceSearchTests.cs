using Microsoft.Extensions.Options;
using Microsoft.Extensions.Time.Testing;
using ScoreMap.Server.GameFeed;
using ScoreMap.Server.Tests.Support;
using ScoreMap.Server.Venues;

namespace ScoreMap.Server.Tests.Venues;

public class NominatimPlaceSearchTests
{
    private const string StadiumHit = """
        [{"place_id":340690243,"osm_type":"way","osm_id":180768146,"lat":"35.2257740","lon":"-80.8528276",
          "category":"leisure","type":"stadium","name":"Bank of America Stadium",
          "display_name":"Bank of America Stadium, 800, South Mint Street, Charlotte, North Carolina, 28202, United States"}]
        """;

    private readonly FakeTimeProvider _clock = new(new DateTimeOffset(2026, 10, 4, 18, 0, 0, TimeSpan.Zero));

    private NominatimPlaceSearch Search(StubHttpHandler handler) => new(
        new HttpClient(handler) { BaseAddress = new Uri("https://nominatim.test/") },
        _clock,
        Options.Create(new NominatimOptions { MinRequestInterval = TimeSpan.FromSeconds(2) }));

    [Fact]
    public async Task Finds_the_position_of_the_best_match()
    {
        var search = Search(StubHttpHandler.Returning(StadiumHit));

        var found = await search.SearchAsync("Bank of America Stadium, Charlotte", CancellationToken.None);

        Assert.Equal(new Coordinates(35.2257740, -80.8528276), found);
    }

    [Fact]
    public async Task Finds_nothing_when_nominatim_has_no_match()
    {
        var search = Search(StubHttpHandler.Returning("[]"));

        Assert.Null(await search.SearchAsync("Nowhere Arena, Atlantis", CancellationToken.None));
    }

    [Fact]
    public async Task Asks_for_one_free_text_match_with_a_descriptive_user_agent()
    {
        var handler = StubHttpHandler.Returning(StadiumHit);

        await Search(handler).SearchAsync("Bank of America Stadium, Charlotte", CancellationToken.None);

        var request = Assert.Single(handler.Requests);
        Assert.Equal("https://nominatim.test/search?q=Bank%20of%20America%20Stadium%2C%20Charlotte&format=jsonv2&limit=1",
            request.RequestUri!.AbsoluteUri);
        Assert.Contains("ScoreMap", request.Headers.UserAgent.ToString());
        Assert.Contains("github.com/phillipbritain/ScoreMap", request.Headers.UserAgent.ToString());
    }

    [Fact]
    public async Task Requests_are_spaced_by_the_minimum_interval()
    {
        var handler = StubHttpHandler.Returning(StadiumHit);
        var search = Search(handler);

        await search.SearchAsync("first", CancellationToken.None);
        var second = search.SearchAsync("second", CancellationToken.None);

        _clock.Advance(TimeSpan.FromSeconds(1.9));
        await Task.Delay(50);
        Assert.Single(handler.Requests);

        _clock.Advance(TimeSpan.FromSeconds(0.1));
        await second.WaitAsync(TimeSpan.FromSeconds(5));
        Assert.Equal(2, handler.Requests.Count);
    }

    private const string StadiumWithTags = """
        [{"place_id":1,"lat":"51.5550404","lon":"-0.1083997","name":"Emirates Stadium",
          "extratags":{"sport":"soccer","capacity":"60361","wikidata":"Q163995","wikipedia":"en:Emirates Stadium"}}]
        """;

    [Fact]
    public async Task Finds_the_wikidata_item_of_the_best_match_from_its_extra_tags()
    {
        var handler = StubHttpHandler.Returning(StadiumWithTags);

        var item = await Search(handler).FindWikidataIdAsync("Emirates Stadium, London", CancellationToken.None);

        Assert.Equal("Q163995", item);
        Assert.Equal("https://nominatim.test/search?q=Emirates%20Stadium%2C%20London&format=jsonv2&limit=1&extratags=1",
            Assert.Single(handler.Requests).RequestUri!.AbsoluteUri);
        Assert.Contains("ScoreMap", handler.Requests[0].Headers.UserAgent.ToString());
    }

    [Theory]
    [InlineData("[]")]
    [InlineData(StadiumHit)]
    [InlineData("""[{"lat":"1","lon":"2","extratags":{"sport":"soccer"}}]""")]
    public async Task Finds_no_wikidata_item_when_there_is_no_match_or_it_has_no_wikidata_tag(string answer)
    {
        Assert.Null(await Search(StubHttpHandler.Returning(answer)).FindWikidataIdAsync("Small Field, Smalltown", CancellationToken.None));
    }

    [Fact]
    public async Task Wikidata_lookups_keep_the_same_spacing_as_place_searches()
    {
        var handler = StubHttpHandler.Returning(StadiumWithTags);
        var search = Search(handler);

        await search.SearchAsync("first", CancellationToken.None);
        var second = search.FindWikidataIdAsync("second", CancellationToken.None);

        _clock.Advance(TimeSpan.FromSeconds(1.9));
        await Task.Delay(50);
        Assert.Single(handler.Requests);

        _clock.Advance(TimeSpan.FromSeconds(0.1));
        await second.WaitAsync(TimeSpan.FromSeconds(5));
        Assert.Equal(2, handler.Requests.Count);
    }
}
