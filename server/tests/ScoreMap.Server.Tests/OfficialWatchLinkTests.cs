using ScoreMap.Server.GameFeed;
using ScoreMap.Server.Games;
using ScoreMap.Server.Tests.Support;

namespace ScoreMap.Server.Tests;

public class OfficialWatchLinkTests
{
    private static ProviderGame GameShownOn(DateTimeOffset now, params ProviderBroadcaster[] broadcasters) =>
        ProviderGames.NflGame(now, ProviderStatus.InProgress) with { Broadcasters = broadcasters };

    [Fact]
    public async Task A_listed_broadcaster_comes_with_its_watch_link()
    {
        await using var server = new ScoreMapServer();
        server.AddWatchLink("https://www.amazon.com/primevideo", "Prime Video");
        server.Feed.SetScoreboard("football/nfl", GameShownOn(server.Clock.GetUtcNow(), new ProviderBroadcaster("Prime Video", "US")));

        await using var client = await server.ConnectClientAsync();
        var game = Assert.Single(await client.NextSnapshotAsync());

        Assert.Equal([new GameBroadcaster("Prime Video", "US", "https://www.amazon.com/primevideo")], game.Broadcasters);
    }

    [Fact]
    public async Task An_unlisted_broadcaster_comes_without_a_link()
    {
        await using var server = new ScoreMapServer();
        server.AddWatchLink("https://www.amazon.com/primevideo", "Prime Video");
        server.Feed.SetScoreboard("football/nfl", GameShownOn(server.Clock.GetUtcNow(), new ProviderBroadcaster("KCOP", "US")));

        await using var client = await server.ConnectClientAsync();
        var game = Assert.Single(await client.NextSnapshotAsync());

        Assert.Equal([new GameBroadcaster("KCOP", "US", null)], game.Broadcasters);
    }

    [Fact]
    public async Task Several_broadcaster_names_can_share_one_link_and_match_whatever_their_case()
    {
        await using var server = new ScoreMapServer();
        server.AddWatchLink("https://www.espn.com/watch/", "ESPN", "ESPN2", "ESPN Unlmtd");
        server.Feed.SetScoreboard("football/nfl", GameShownOn(server.Clock.GetUtcNow(),
            new ProviderBroadcaster("espn2", null), new ProviderBroadcaster(" ESPN Unlmtd ", null)));

        await using var client = await server.ConnectClientAsync();
        var game = Assert.Single(await client.NextSnapshotAsync());

        Assert.All(game.Broadcasters, b => Assert.Equal("https://www.espn.com/watch/", b.WatchUrl));
    }

    [Fact]
    public async Task A_link_added_to_the_file_takes_effect_without_a_restart()
    {
        await using var server = new ScoreMapServer();
        server.Feed.SetScoreboard("football/nfl", GameShownOn(server.Clock.GetUtcNow(), new ProviderBroadcaster("Peacock", "US")));
        await using (var before = await server.ConnectClientAsync())
            Assert.Null(Assert.Single(Assert.Single(await before.NextSnapshotAsync()).Broadcasters).WatchUrl);

        server.AddWatchLink("https://www.peacocktv.com/", "Peacock");

        await using var after = await server.ConnectClientAsync();
        var game = Assert.Single(await after.NextSnapshotAsync());
        Assert.Equal("https://www.peacocktv.com/", Assert.Single(game.Broadcasters).WatchUrl);
    }

    [Fact]
    public async Task The_shipped_watch_links_file_links_common_us_services()
    {
        await using var server = new ScoreMapServer(useShippedWatchLinks: true);
        server.Feed.SetScoreboard("football/nfl", GameShownOn(server.Clock.GetUtcNow(),
            new ProviderBroadcaster("ESPN+", "US"), new ProviderBroadcaster("Peacock", "US"), new ProviderBroadcaster("Prime Video", "US")));

        await using var client = await server.ConnectClientAsync();
        var game = Assert.Single(await client.NextSnapshotAsync());

        Assert.All(game.Broadcasters, b => Assert.StartsWith("https://", b.WatchUrl));
    }
}
