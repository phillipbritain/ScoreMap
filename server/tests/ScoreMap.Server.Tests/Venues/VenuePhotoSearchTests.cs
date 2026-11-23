using ScoreMap.Server.GameFeed;
using ScoreMap.Server.Games;
using ScoreMap.Server.Scenarios;
using ScoreMap.Server.Tests.Support;
using ScoreMap.Server.Venues;
using static ScoreMap.Server.Tests.Support.StubHttpHandler;

namespace ScoreMap.Server.Tests.Venues;

/// <summary>
/// The venue photo search against canned answers shaped like ESPN’s core API.
/// </summary>
public class VenuePhotoSearchTests
{
    private static readonly ProviderVenue BankOfAmerica = new("Bank of America Stadium", "Charlotte", "NC", "USA", "3628");
    private static readonly ProviderVenue Emirates = new("Emirates Stadium", "London", null, "England", "2267");

    private const string EspnBankOfAmerica = "https://sports.core.api.espn.com/v2/sports/football/leagues/nfl/venues/3628";
    private const string EspnEmirates = "https://sports.core.api.espn.com/v2/sports/soccer/leagues/eng.1/venues/2267";
    private const string BankOfAmericaImages = """
        {"id":"3628","fullName":"Bank of America Stadium","images":[
          {"href":"https://a.espncdn.com/i/venues/nfl/day/interior/3628.jpg","width":2000,"height":1125,"rel":["full","day","interior"]},
          {"href":"https://a.espncdn.com/i/venues/nfl/day/3628.jpg","width":2000,"height":1125,"rel":["full","day"]}]}
        """;

    private const string NoImages = """{"id":"2267","fullName":"Emirates Stadium","images":[]}""";

    // Soldier Field, as the venue list has it: ESPN's id and city for it in the NFL and in MLS.
    private static readonly VenueLeagueCatalog SoldierFieldCatalog = new(
        [new ScenarioVenue("Soldier Field",
        [
            new ScenarioVenueLeague("NFL", "3933", "Chicago", "IL", "USA", ["Chicago Bears"]),
            new ScenarioVenueLeague("MLS", "1452", "Chicago, Illinois", null, "USA", ["Chicago Fire FC"]),
        ], ["worldwide"])],
        [
            new League { Key = "football/nfl", Name = "NFL", Sport = Sport.Football },
            new League { Key = "soccer/usa.1", Name = "MLS", Sport = Sport.Soccer },
        ]);

    private const string EspnSoldierFieldMls = "https://sports.core.api.espn.com/v2/sports/soccer/leagues/usa.1/venues/1452";
    private const string EspnSoldierFieldNfl = "https://sports.core.api.espn.com/v2/sports/football/leagues/nfl/venues/3933";
    private const string SoldierFieldNflImages = """
        {"id":"3933","images":[{"href":"https://a.espncdn.com/i/venues/nfl/day/interior/3933.jpg","width":2000,"rel":["full","day","interior"]}]}
        """;
    private static readonly ProviderVenue SoldierFieldMls = new("Soldier Field", "Chicago, Illinois", null, "USA", "1452");

    private static VenuePhotoSearch Search(StubHttpHandler handler, VenueLeagueCatalog? catalog = null) =>
        new(new HttpClient(handler), catalog);

    [Fact]
    public async Task Takes_another_leagues_espn_photo_of_the_venue_when_the_games_league_has_none()
    {
        var handler = Serving((EspnSoldierFieldMls, """{"id":"1452","images":[]}"""), (EspnSoldierFieldNfl, SoldierFieldNflImages));

        var photo = await Search(handler, SoldierFieldCatalog).SearchAsync("soccer/usa.1", SoldierFieldMls, CancellationToken.None);

        Assert.Equal(new VenuePhoto("https://a.espncdn.com/combiner/i?img=/i/venues/nfl/day/interior/3933.jpg&w=720", null), photo);
        Assert.Equal([EspnSoldierFieldMls, EspnSoldierFieldNfl], handler.Requests.Select(r => r.RequestUri!.AbsoluteUri));
    }

    [Fact]
    public async Task Keeps_the_games_own_leagues_photo_over_another_leagues()
    {
        var handler = Serving((EspnSoldierFieldMls, """
            {"id":"1452","images":[{"href":"https://a.espncdn.com/i/venues/soccer/day/1452.jpg","width":2000,"rel":["full","day"]}]}
            """), (EspnSoldierFieldNfl, SoldierFieldNflImages));

        var photo = await Search(handler, SoldierFieldCatalog).SearchAsync("soccer/usa.1", SoldierFieldMls, CancellationToken.None);

        Assert.Equal(new VenuePhoto("https://a.espncdn.com/combiner/i?img=/i/venues/soccer/day/1452.jpg&w=720", null), photo);
        Assert.Single(handler.Requests);
    }

    [Fact]
    public async Task Finds_no_photo_when_neither_league_has_a_suitable_espn_image()
    {
        var handler = Serving((EspnSoldierFieldMls, """{"id":"1452","images":[]}"""),
            (EspnSoldierFieldNfl, """{"id":"3933","images":[{"href":"https://a.espncdn.com/i/venues/nfl/day/3933.jpg","width":500,"rel":["full","day"]}]}"""));

        var photo = await Search(handler, SoldierFieldCatalog).SearchAsync("soccer/usa.1", SoldierFieldMls, CancellationToken.None);

        Assert.Null(photo);
        Assert.Equal([EspnSoldierFieldMls, EspnSoldierFieldNfl], handler.Requests.Select(r => r.RequestUri!.AbsoluteUri));
    }

    [Theory]
    [InlineData("Soldier Field", "Springfield")]
    [InlineData("Wrigley Field", "Chicago")]
    public void A_venue_not_in_the_list_or_of_the_same_name_elsewhere_has_no_other_leagues(string name, string city)
    {
        Assert.Empty(SoldierFieldCatalog.OtherLeagues("soccer/usa.1", new ProviderVenue(name, city, null, "USA", "1")));
    }

    [Fact]
    public void A_venue_in_the_list_has_its_other_leagues_ids_however_its_league_writes_its_city()
    {
        Assert.Equal([("football/nfl", "3933")], SoldierFieldCatalog.OtherLeagues("soccer/usa.1", SoldierFieldMls));
        Assert.Equal([("soccer/usa.1", "1452")],
            SoldierFieldCatalog.OtherLeagues("football/nfl", new ProviderVenue("Soldier Field", "Chicago", "IL", "USA", "3933")));
    }

    [Fact]
    public async Task Uses_espns_interior_photo_over_its_main_one_resized_for_the_panel_without_asking_anyone_else()
    {
        var handler = Serving((EspnBankOfAmerica, BankOfAmericaImages));

        var photo = await Search(handler).SearchAsync("football/nfl", BankOfAmerica, CancellationToken.None);

        Assert.Equal(new VenuePhoto("https://a.espncdn.com/combiner/i?img=/i/venues/nfl/day/interior/3628.jpg&w=720", null), photo);
        Assert.Single(handler.Requests);
    }

    [Fact]
    public async Task Uses_espns_main_photo_when_it_has_no_interior_one()
    {
        // Arenas and ballparks have only a day image, of the bowl.
        var handler = Serving((EspnBankOfAmerica, """
            {"id":"3628","images":[{"href":"https://a.espncdn.com/i/venues/nfl/day/3628.jpg","rel":["full","day"]}]}
            """));

        var photo = await Search(handler).SearchAsync("football/nfl", BankOfAmerica, CancellationToken.None);

        Assert.Equal(new VenuePhoto("https://a.espncdn.com/combiner/i?img=/i/venues/nfl/day/3628.jpg&w=720", null), photo);
    }

    [Fact]
    public async Task Asks_espn_for_the_venue_in_the_games_sport_and_league()
    {
        var handler = StubHttpHandler.Returning("{}");
        var venue = new ProviderVenue("Palazzo dello Sport", "Rome", "Italy", null, "3282");

        await Search(handler).SearchAsync("basketball/mens-college-basketball?groups=50", venue, CancellationToken.None);

        Assert.Equal("https://sports.core.api.espn.com/v2/sports/basketball/leagues/mens-college-basketball/venues/3282",
            Assert.Single(handler.Requests).RequestUri!.AbsoluteUri);
    }

    [Fact]
    public async Task Finds_no_photo_for_a_venue_without_espn_images()
    {
        var handler = Serving((EspnEmirates, NoImages));

        Assert.Null(await Search(handler).SearchAsync("soccer/eng.1", Emirates, CancellationToken.None));
        Assert.Equal(EspnEmirates, Assert.Single(handler.Requests).RequestUri!.AbsoluteUri);
    }

    [Fact]
    public async Task Skips_a_venue_without_an_espn_id()
    {
        var handler = StubHttpHandler.Returning("{}");

        Assert.Null(await Search(handler).SearchAsync("soccer/eng.1", Emirates with { Id = null }, CancellationToken.None));
        Assert.Empty(handler.Requests);
    }

    [Fact]
    public async Task An_espn_error_fails_the_search_instead_of_caching_a_miss()
    {
        var handler = Serving((EspnEmirates, ServerError));

        await Assert.ThrowsAsync<HttpRequestException>(() =>
            Search(handler).SearchAsync("soccer/eng.1", Emirates, CancellationToken.None));
    }
}
