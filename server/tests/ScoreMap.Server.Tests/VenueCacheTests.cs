using System.Text.Json;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using ScoreMap.Server.GameFeed;
using ScoreMap.Server.Games;
using ScoreMap.Server.Tests.Support;
using ScoreMap.Server.Venues;
using static ScoreMap.Server.Tests.Support.TestGames;

namespace ScoreMap.Server.Tests;

public sealed class VenueCacheTests
{
    private const string VenueName = "GEHA Field at Arrowhead Stadium";
    private const string Query = VenueName + ", Kansas City";
    private static readonly Coordinates Position = new(39.0489, -94.4839);
    private static readonly VenuePhoto Photo = new("https://photos.test/arrowhead.jpg", null);

    [Fact]
    public async Task Unreadable_cache_paths_and_failed_replacements_do_not_stop_game_updates()
    {
        var folder = Path.Combine(Path.GetTempPath(), $"scoremap-cache-{Guid.NewGuid():N}");
        var locations = Path.Combine(folder, "locations.json");
        var photos = Path.Combine(folder, "photos.json");
        // Opening a directory as a file fails even when the test runs with elevated privileges.
        Directory.CreateDirectory(locations);
        Directory.CreateDirectory(photos);
        try
        {
            await using var server = new ScoreMapServer(locations, savedVenuePhotosPath: photos);
            server.Places.Add(Query, Position);
            server.Photos.Add(VenueName, Photo);
            var game = LiveGame(server.Clock, "401", homeScore: 21);
            server.Feed.SetScoreboard(Nfl, game);
            await using var client = await server.ConnectClientAsync();
            Assert.Equal(Position.Latitude, (await client.PlacedGameAsync()).Venue.Latitude);
            await server.PhotoSearchesFinishedAsync();

            server.Feed.SetScoreboard(Nfl, game.WithSides(home: game.Sides().Home with { Score = 24 }));
            server.Clock.Advance(TimeSpan.FromSeconds(15));
            var change = await client.NextChangeAsync();

            Assert.Equal("24", change.Game.Sides().Home.Score);
            Assert.Equal(Photo, change.Game.Venue.Photo);
            Assert.Equal([Query], server.Places.Queries);
            Assert.Equal([VenueName], server.Photos.Searches);
            Assert.Equal(2, server.Logs.Entries.Count(e => e.Level == LogLevel.Warning
                && e.Message.Contains("Could not read venue cache")
                && e.Exception is IOException or UnauthorizedAccessException));
            Assert.Equal(2, server.Logs.Entries.Count(e => e.Level == LogLevel.Warning
                && e.Message.Contains("Could not save venue cache")
                && e.Exception is IOException or UnauthorizedAccessException));
        }
        finally
        {
            Directory.Delete(folder, recursive: true);
        }
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task Caller_cancellation_is_propagated_before_loading_or_during_recovery_lookup(bool duringLookup)
    {
        await using var server = new ScoreMapServer();
        File.WriteAllText(server.SavedVenueLocationsPath, "{broken");
        using var cancellation = new CancellationTokenSource();
        if (duringLookup)
            server.Places.OnSearch(Query, cancellation.Cancel);
        else
            cancellation.Cancel();
        var locator = server.Services.GetRequiredService<VenueLocator>();
        try
        {
            await Assert.ThrowsAnyAsync<OperationCanceledException>(() => locator.LocateAsync(
                new ProviderVenue(VenueName, "Kansas City", null, null), null, cancellation.Token));

            Assert.DoesNotContain(server.Logs.Entries, e => e.Message.Contains("Could not save venue cache"));
            Assert.Equal(duringLookup ? [Query] : Array.Empty<string>(), server.Places.Queries);
            if (!duringLookup)
                Assert.Equal("{broken", File.ReadAllText(server.SavedVenueLocationsPath));
        }
        finally
        {
            foreach (var path in Directory.GetFiles(Path.GetDirectoryName(server.SavedVenueLocationsPath)!,
                Path.GetFileName(server.SavedVenueLocationsPath) + ".corrupt-*"))
                File.Delete(path);
        }
    }

    [Fact]
    public async Task Recovering_a_cache_keeps_nominatim_requests_spaced_and_cached()
    {
        await using var server = new ScoreMapServer();
        File.WriteAllText(server.SavedVenueLocationsPath, "{broken");
        var handler = StubHttpHandler.Returning("""[{"lat":"39.0489","lon":"-94.4839"}]""");
        using var client = new HttpClient(handler) { BaseAddress = new Uri("https://nominatim.test/") };
        var search = new NominatimPlaceSearch(client, server.Clock,
            Options.Create(new NominatimOptions { MinRequestInterval = TimeSpan.FromSeconds(2) }));
        var locator = ActivatorUtilities.CreateInstance<VenueLocator>(server.Services, search);
        var venue = new ProviderVenue(VenueName, "Kansas City", null, null);
        try
        {
            Assert.Equal(Position, (await locator.LocateAsync(venue, null, CancellationToken.None)).Location);
            using var cancellation = new CancellationTokenSource();
            var pending = locator.LocateAsync(venue with { Name = "Another venue" }, null, cancellation.Token);
            Assert.False(pending.IsCompleted);
            Assert.Single(handler.Requests);
            cancellation.Cancel();
            await Assert.ThrowsAnyAsync<OperationCanceledException>(() => pending);

            var next = locator.LocateAsync(venue with { Name = "Another venue" }, null, CancellationToken.None);
            Assert.False(next.IsCompleted);
            server.Clock.Advance(TimeSpan.FromSeconds(2));
            Assert.Equal(Position, (await next.WaitAsync(TimeSpan.FromSeconds(5))).Location);
            Assert.Equal(Position, (await locator.LocateAsync(venue, null, CancellationToken.None)).Location);
            Assert.Equal(2, handler.Requests.Count);
        }
        finally
        {
            foreach (var path in Directory.GetFiles(Path.GetDirectoryName(server.SavedVenueLocationsPath)!,
                Path.GetFileName(server.SavedVenueLocationsPath) + ".corrupt-*"))
                File.Delete(path);
        }
    }

    [Fact]
    public async Task Failed_cache_writes_keep_results_in_memory_and_preserve_previous_files()
    {
        var folder = Path.Combine(Path.GetTempPath(), $"scoremap-cache-{Guid.NewGuid():N}");
        Directory.CreateDirectory(folder);
        var locations = Path.Combine(folder, "locations.json");
        var photos = Path.Combine(folder, "photos.json");
        const string oldLocations = "{\"Previously searched venue\":null}";
        const string oldPhotos = "{\"version\":2,\"photos\":{\"Previously searched venue\":null}}";
        File.WriteAllText(locations, oldLocations);
        File.WriteAllText(photos, oldPhotos);
        // Deterministically deny creation of either temp file, without relying on OS permissions.
        Directory.CreateDirectory(locations + ".tmp");
        Directory.CreateDirectory(photos + ".tmp");
        try
        {
            await using var server = new ScoreMapServer(locations, savedVenuePhotosPath: photos);
            server.Places.Add(Query, Position);
            server.Photos.Add(VenueName, Photo);
            var game = LiveGame(server.Clock, "401", homeScore: 21);
            server.Feed.SetScoreboard(Nfl, game);
            await using var client = await server.ConnectClientAsync();
            var snapshot = await client.PlacedGameAsync();
            Assert.Equal(Position.Latitude, snapshot.Venue.Latitude);
            await server.PhotoSearchesFinishedAsync();

            server.Feed.SetScoreboard(Nfl, game.WithSides(home: game.Sides().Home with { Score = 24 }));
            server.Clock.Advance(TimeSpan.FromSeconds(15));
            var change = await client.NextChangeAsync();

            Assert.Equal("24", change.Game.Sides().Home.Score);
            Assert.Equal(Position.Longitude, change.Game.Venue.Longitude);
            Assert.Equal(Photo, change.Game.Venue.Photo);
            Assert.Equal([Query], server.Places.Queries);
            Assert.Equal([VenueName], server.Photos.Searches);
            Assert.Equal(oldLocations, File.ReadAllText(locations));
            Assert.Equal(oldPhotos, File.ReadAllText(photos));
            Assert.Equal(2, server.Logs.Entries.Count(e => e.Level == LogLevel.Warning
                && e.Message.Contains("Could not save venue cache")
                && e.Exception is IOException or UnauthorizedAccessException));
            Assert.DoesNotContain(server.Logs.Entries, e => e.Message.Contains("Photo search failed"));
        }
        finally
        {
            Directory.Delete(folder, recursive: true);
        }
    }

    [Theory]
    [InlineData("{broken")]
    [InlineData("[]")]
    public async Task Malformed_runtime_caches_do_not_stop_snapshots_or_score_updates(string broken)
    {
        var folder = Path.Combine(Path.GetTempPath(), $"scoremap-cache-{Guid.NewGuid():N}");
        Directory.CreateDirectory(folder);
        var locations = Path.Combine(folder, "locations.json");
        var photos = Path.Combine(folder, "photos.json");
        File.WriteAllText(locations, broken);
        File.WriteAllText(photos, broken);
        try
        {
            await using var server = new ScoreMapServer(locations, savedVenuePhotosPath: photos);
            server.Places.Add(Query, Position);
            server.Photos.Add(VenueName, Photo);
            var game = LiveGame(server.Clock, "401", homeScore: 21);
            server.Feed.SetScoreboard(Nfl, game);
            await using var client = await server.ConnectClientAsync();

            var snapshot = await client.PlacedGameAsync();
            Assert.Equal(Position.Latitude, snapshot.Venue.Latitude);
            Assert.Equal(Position.Longitude, snapshot.Venue.Longitude);
            await server.PhotoSearchesFinishedAsync();
            server.Feed.SetScoreboard(Nfl, game.WithSides(home: game.Sides().Home with { Score = 24 }));
            server.Clock.Advance(TimeSpan.FromSeconds(15));

            var change = await client.NextChangeAsync();
            Assert.Equal("24", change.Game.Sides().Home.Score);
            Assert.Equal(Photo, change.Game.Venue.Photo);
            Assert.Equal([Query], server.Places.Queries);
            Assert.Equal([VenueName], server.Photos.Searches);
            Assert.Equal(2, server.Logs.Entries.Count(e => e.Level == LogLevel.Warning && e.Exception is JsonException));
            Assert.Equal(2, Directory.GetFiles(folder, "*.corrupt-*").Length);
            Assert.All(Directory.GetFiles(folder, "*.corrupt-*"), path => Assert.Equal(broken, File.ReadAllText(path)));
        }
        finally
        {
            Directory.Delete(folder, recursive: true);
        }
    }
}
