using ScoreMap.Server.Games;
using ScoreMap.Server.Tests.Support;
using ScoreMap.Server.Venues;
using static ScoreMap.Server.Tests.Support.TestGames;

namespace ScoreMap.Server.Tests;

/// <summary>
/// Venue photos for the game panel. Photos are searched for in the background, so a venue's
/// photo reaches browsers with the poll after it is found, and is saved so it's found only once.
/// </summary>
public class VenuePhotoTests
{
    private const string Arrowhead = "GEHA Field at Arrowhead Stadium";

    private static readonly VenuePhoto ArrowheadPhoto = new("https://photos.test/arrowhead.jpg", null);

    [Fact]
    public async Task A_venues_photo_reaches_the_game_panel_on_the_next_poll()
    {
        await using var server = new ScoreMapServer();
        server.Photos.Add(Arrowhead, ArrowheadPhoto);
        server.Feed.SetScoreboard(Nfl, LiveGame(server.Clock, "401"));
        await using var client = await server.ConnectClientAsync();
        Assert.Null(Assert.Single(await client.NextSnapshotAsync()).Venue.Photo);

        await server.PhotoSearchesFinishedAsync();
        server.Clock.Advance(TimeSpan.FromSeconds(15));

        var change = await client.NextChangeAsync();
        Assert.Equal(GameChangeKind.Updated, change.Kind);
        Assert.Equal(ArrowheadPhoto, change.Game.Venue.Photo);
    }

    [Fact]
    public async Task Each_venue_is_searched_for_only_once()
    {
        await using var server = new ScoreMapServer();
        server.Photos.Add(Arrowhead, ArrowheadPhoto);
        server.Feed.SetScoreboard(Nfl, LiveGame(server.Clock, "401"), LiveGame(server.Clock, "402"));
        await using var client = await server.ConnectClientAsync();
        await client.NextSnapshotAsync();

        await server.PhotoSearchesFinishedAsync();
        server.Clock.Advance(TimeSpan.FromSeconds(15));
        await server.Feed.WaitForFetchesAsync(Nfl, 2);
        server.Clock.Advance(TimeSpan.FromSeconds(15));
        await server.Feed.WaitForFetchesAsync(Nfl, 3);
        await server.PhotoSearchesFinishedAsync();

        Assert.Equal([Arrowhead], server.Photos.Searches);
    }

    [Fact]
    public async Task A_restarted_server_shows_the_saved_photo_straight_away_without_searching_again()
    {
        // Both runs share a file the test owns, as a server deletes a saved-photos file it made itself.
        var savedPhotos = Path.Combine(Path.GetTempPath(), $"scoremap-photos-{Guid.NewGuid():N}.json");
        await using (var firstRun = new ScoreMapServer(savedVenuePhotosPath: savedPhotos))
        {
            firstRun.Photos.Add(Arrowhead, ArrowheadPhoto);
            firstRun.Feed.SetScoreboard(Nfl, LiveGame(firstRun.Clock, "401"));
            await firstRun.SnapshotOnceAsync();
            await firstRun.PhotoSearchesFinishedAsync();
        }

        try
        {
            await using var secondRun = new ScoreMapServer(savedVenuePhotosPath: savedPhotos);
            secondRun.Feed.SetScoreboard(Nfl, LiveGame(secondRun.Clock, "401"));

            var game = Assert.Single(await secondRun.SnapshotOnceAsync());

            Assert.Equal(ArrowheadPhoto, game.Venue.Photo);
            Assert.Empty(secondRun.Photos.Searches);
        }
        finally
        {
            File.Delete(savedPhotos);
        }
    }

    [Fact]
    public async Task A_venue_without_a_photo_is_remembered_too()
    {
        // Both runs share a file the test owns, as a server deletes a saved-photos file it made itself.
        var savedPhotos = Path.Combine(Path.GetTempPath(), $"scoremap-photos-{Guid.NewGuid():N}.json");
        await using (var firstRun = new ScoreMapServer(savedVenuePhotosPath: savedPhotos))
        {
            firstRun.Feed.SetScoreboard(Nfl, LiveGame(firstRun.Clock, "401"));
            await firstRun.SnapshotOnceAsync();
            await firstRun.PhotoSearchesFinishedAsync();
        }

        try
        {
            await using var secondRun = new ScoreMapServer(savedVenuePhotosPath: savedPhotos);
            secondRun.Feed.SetScoreboard(Nfl, LiveGame(secondRun.Clock, "401"));

            var game = Assert.Single(await secondRun.SnapshotOnceAsync());

            Assert.Null(game.Venue.Photo);
            Assert.Empty(secondRun.Photos.Searches);
        }
        finally
        {
            File.Delete(savedPhotos);
        }
    }

    [Fact]
    public async Task A_failed_search_is_not_saved_and_is_tried_again_after_a_while_not_every_poll()
    {
        await using var server = new ScoreMapServer();
        server.Photos.Add(Arrowhead, ArrowheadPhoto);
        server.Photos.Fail(Arrowhead);
        server.Feed.SetScoreboard(Nfl, LiveGame(server.Clock, "401"));
        await using var client = await server.ConnectClientAsync();
        await client.NextSnapshotAsync();
        await server.PhotoSearchesFinishedAsync();

        server.Photos.Recover(Arrowhead);
        server.Clock.Advance(TimeSpan.FromSeconds(15));
        await server.Feed.WaitForFetchesAsync(Nfl, 2);
        await server.PhotoSearchesFinishedAsync();
        Assert.Single(server.Photos.Searches);

        server.Clock.Advance(VenuePhotos.RetryAfterFailure);
        // The fetch comes before the search it starts, so wait for the search itself.
        await server.Photos.WaitForSearchesAsync(2);
        await server.PhotoSearchesFinishedAsync();
        server.Clock.Advance(TimeSpan.FromSeconds(15));

        var change = await client.NextChangeAsync();
        Assert.Equal(ArrowheadPhoto, change.Game.Venue.Photo);
        Assert.Equal([Arrowhead, Arrowhead], server.Photos.Searches);
    }
}
