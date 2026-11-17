using System.Net;
using System.Net.Http.Json;
using ScoreMap.Server.Games;
using ScoreMap.Server.Tests.Support;
using static ScoreMap.Server.Tests.Support.TestGames;

namespace ScoreMap.Server.Tests;

/// <summary>
/// A venue's photo for a game the browser makes itself (the welcome tour's), found and saved the
/// same way as a real game's.
/// </summary>
public class VenuePhotoEndpointTests
{
    private const string Arrowhead = "GEHA Field at Arrowhead Stadium";
    private const string ArrowheadAddress = "/api/venue-photo?league=NFL&name=GEHA%20Field%20at%20Arrowhead%20Stadium&city=Kansas%20City";

    private static readonly VenuePhoto ArrowheadPhoto = new("https://photos.test/arrowhead.jpg", null);

    [Fact]
    public async Task The_browser_gets_a_venues_photo_on_its_first_ask_and_the_venue_is_searched_for_once()
    {
        await using var server = new ScoreMapServer();
        server.Photos.Add(Arrowhead, ArrowheadPhoto);
        using var http = server.CreateClient();

        var first = await http.GetFromJsonAsync<VenuePhoto>(ArrowheadAddress, TestContext.Current.CancellationToken);
        var again = await http.GetFromJsonAsync<VenuePhoto>(ArrowheadAddress, TestContext.Current.CancellationToken);

        Assert.Equal(ArrowheadPhoto, first);
        Assert.Equal(ArrowheadPhoto, again);
        Assert.Equal([Arrowhead], server.Photos.Searches);
    }

    [Fact]
    public async Task The_venues_ESPN_id_reaches_the_search_so_ESPNs_photo_is_found_as_for_a_real_game()
    {
        await using var server = new ScoreMapServer();
        using var http = server.CreateClient();

        await http.GetAsync($"{ArrowheadAddress}&id=3622", TestContext.Current.CancellationToken);

        Assert.Equal("3622", Assert.Single(server.Photos.SearchedVenues).Id);
    }

    [Fact]
    public async Task A_photo_found_for_a_real_game_at_the_venue_is_the_one_the_browser_gets()
    {
        await using var server = new ScoreMapServer();
        server.Photos.Add(Arrowhead, ArrowheadPhoto);
        server.Feed.SetScoreboard(Nfl, LiveGame(server.Clock, "401"));
        await server.SnapshotOnceAsync();
        await server.PhotoSearchesFinishedAsync();
        using var http = server.CreateClient();

        var photo = await http.GetFromJsonAsync<VenuePhoto>(ArrowheadAddress, TestContext.Current.CancellationToken);

        Assert.Equal(ArrowheadPhoto, photo);
        Assert.Equal([Arrowhead], server.Photos.Searches);
    }

    [Fact]
    public async Task A_venue_with_no_photo_answers_with_none()
    {
        await using var server = new ScoreMapServer();
        using var http = server.CreateClient();

        var response = await http.GetAsync(ArrowheadAddress, TestContext.Current.CancellationToken);

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
    }

    [Fact]
    public async Task A_league_ScoreMap_does_not_show_is_not_found_and_nothing_is_searched_for()
    {
        await using var server = new ScoreMapServer();
        using var http = server.CreateClient();

        var response = await http.GetAsync("/api/venue-photo?league=XFL&name=Somewhere", TestContext.Current.CancellationToken);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.Empty(server.Photos.Searches);
    }
}
