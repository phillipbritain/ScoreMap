using ScoreMap.Server.GameFeed;
using ScoreMap.Server.Live;
using ScoreMap.Server.Tests.Support;

namespace ScoreMap.Server.Tests.Hosting;

/// <summary>
/// On Azure App Service only HOME (/home) is writable and survives restarts and redeploys, so
/// that is where the server saves venue lookups unless told otherwise.
/// </summary>
public sealed class AppServiceDataTests : IDisposable
{
    private static readonly Coordinates Tottenham = new(51.6043, -0.0664);

    private readonly string _home = Directory.CreateTempSubdirectory("scoremap-home-").FullName;

    public void Dispose() => Directory.Delete(_home, recursive: true);

    private static ProviderGame LondonGame() => new(
        Id: "401872965",
        LeagueKey: "football/nfl",
        StartTime: new DateTimeOffset(2026, 10, 4, 13, 30, 0, TimeSpan.Zero),
        Home: new ProviderTeam("WSH", "Washington Commanders", null, 13),
        Away: new ProviderTeam("IND", "Indianapolis Colts", null, 30),
        Status: ProviderStatus.Final,
        DisplayClock: "0:00",
        Period: 4,
        Venue: new ProviderVenue("Tottenham Hotspur Stadium", "London", null, "England"),
        Broadcasters: []);

    [Fact]
    public async Task Venue_lookups_are_saved_under_home_data_on_app_service()
    {
        await using var server = new ScoreMapServer { AppServiceHome = _home };
        server.Places.Add("Tottenham Hotspur Stadium, London", Tottenham);
        server.Feed.SetScoreboard("football/nfl", LondonGame());

        await using var client = await server.ConnectClientAsync();
        await client.NextSnapshotAsync();

        Assert.True(File.Exists(Path.Combine(_home, "data", "venue-locations.json")));
    }

    [Fact]
    public async Task An_app_service_restart_keeps_the_saved_venue_lookups()
    {
        await using (var beforeSleep = new ScoreMapServer { AppServiceHome = _home })
        {
            beforeSleep.Places.Add("Tottenham Hotspur Stadium, London", Tottenham);
            beforeSleep.Feed.SetScoreboard("football/nfl", LondonGame());
            await using var client = await beforeSleep.ConnectClientAsync();
            await client.NextSnapshotAsync();
        }

        await using var afterWake = new ScoreMapServer { AppServiceHome = _home };
        afterWake.Feed.SetScoreboard("football/nfl", LondonGame());
        await using var woken = await afterWake.ConnectClientAsync();
        var game = Assert.Single(await woken.NextSnapshotAsync());

        Assert.Equal((51.6043, -0.0664), (game.Venue.Latitude, game.Venue.Longitude));
        Assert.Empty(afterWake.Places.Queries);
    }
}
