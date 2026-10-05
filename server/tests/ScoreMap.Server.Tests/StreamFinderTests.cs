using ScoreMap.Server.Games;
using ScoreMap.Server.Tests.Support;
using ScoreMap.Server.WatchLinks;
using static ScoreMap.Server.Tests.Support.TestGames;

namespace ScoreMap.Server.Tests;

/// <summary>
/// The unofficial stream finder (ADR-0002), against made-up sites. Searches run in the
/// background, so links found for a game reach browsers with the next poll.
/// </summary>
public class StreamFinderTests
{
    private const string Anchor = "<a href=\"(?<href>[^\"]+)\">(?<text>[^<]*)</a>";

    private const string SearchPage = """
        <html><body>
          <a href="/watch/lions-vs-panthers">Detroit Lions vs Carolina Panthers</a>
          <a href="/watch/bills-vs-chiefs">Buffalo Bills vs Kansas City Chiefs</a>
          <a href="/about">About us</a>
        </body></html>
        """;

    [Fact]
    public async Task A_link_a_site_has_for_the_game_reaches_the_game_panel_on_the_next_poll()
    {
        await using var server = new ScoreMapServer();
        server.AddStreamSite("Streams One", "https://streams-one.test/search?q={query}", Anchor);
        server.StreamSites.Serve("streams-one.test", SearchPage);
        server.Feed.SetScoreboard(Nfl, LiveGame(server.Clock, "401"));
        await using var client = await server.ConnectClientAsync();
        Assert.Empty(Assert.Single(await client.NextSnapshotAsync()).StreamLinks);

        await server.StreamSearchesFinishedAsync();
        server.Clock.Advance(TimeSpan.FromSeconds(15));

        var change = await client.NextChangeAsync();
        Assert.Equal(GameChangeKind.Updated, change.Kind);
        Assert.Equal([new StreamLink("Streams One", "https://streams-one.test/watch/bills-vs-chiefs")], change.Game.StreamLinks);
    }

    [Fact]
    public async Task A_site_without_a_link_for_the_game_leaves_it_without_stream_links_and_pushes_nothing()
    {
        await using var server = new ScoreMapServer();
        server.AddStreamSite("Streams One", "https://streams-one.test/search?q={query}", Anchor);
        server.StreamSites.Serve("streams-one.test", """<a href="/watch/lions-vs-panthers">Detroit Lions vs Carolina Panthers</a>""");
        server.Feed.SetScoreboard(Nfl, LiveGame(server.Clock, "401"));
        await using var client = await server.ConnectClientAsync();
        await client.NextSnapshotAsync();

        await server.StreamSearchesFinishedAsync();
        server.Clock.Advance(TimeSpan.FromSeconds(15));
        await server.Feed.WaitForFetchesAsync(Nfl, 2);
        server.Feed.SetScoreboard(Nfl, LiveGame(server.Clock, "401", homeScore: 3));
        server.Clock.Advance(TimeSpan.FromSeconds(15));

        var change = await client.NextChangeAsync();
        Assert.Equal(GameChangeKind.ScoreChanged, change.Kind);
        Assert.Empty(change.Game.StreamLinks);
    }

    [Fact]
    public async Task A_failing_site_gives_no_links_while_other_sites_still_do()
    {
        await using var server = new ScoreMapServer();
        server.AddStreamSite("Broken", "https://broken.test/search?q={query}", Anchor);
        server.AddStreamSite("Streams Two", "https://streams-two.test/find/{away}/{home}", Anchor);
        server.StreamSites.Fail("broken.test");
        server.StreamSites.Serve("streams-two.test", SearchPage);
        server.Feed.SetScoreboard(Nfl, LiveGame(server.Clock, "401"));
        await using var client = await server.ConnectClientAsync();
        await client.NextSnapshotAsync();

        await server.StreamSearchesFinishedAsync();
        server.Clock.Advance(TimeSpan.FromSeconds(15));

        var change = await client.NextChangeAsync();
        Assert.Equal([new StreamLink("Streams Two", "https://streams-two.test/watch/bills-vs-chiefs")], change.Game.StreamLinks);
        Assert.Contains(server.StreamSites.Requests, uri => uri.AbsolutePath == "/find/Buffalo%20Bills/Kansas%20City%20Chiefs");
    }

    [Fact]
    public async Task A_site_that_never_answers_does_not_delay_score_updates()
    {
        await using var server = new ScoreMapServer { StreamSiteTimeout = TimeSpan.FromMinutes(5) };
        server.AddStreamSite("Stuck", "https://stuck.test/search?q={query}", Anchor);
        server.StreamSites.Hang("stuck.test");
        var game = LiveGame(server.Clock, "401");
        server.Feed.SetScoreboard(Nfl, game);
        await using var client = await server.ConnectClientAsync();
        await client.NextSnapshotAsync();

        server.Feed.SetScoreboard(Nfl, game with { Home = game.Home with { Score = 7 } });
        server.Clock.Advance(TimeSpan.FromSeconds(15));

        var change = await client.NextChangeAsync();
        Assert.Equal(GameChangeKind.ScoreChanged, change.Kind);
        Assert.Empty(change.Game.StreamLinks);
    }

    [Fact]
    public async Task A_site_that_answers_too_slowly_is_given_up_on()
    {
        await using var server = new ScoreMapServer { StreamSiteTimeout = TimeSpan.FromMilliseconds(100) };
        server.AddStreamSite("Stuck", "https://stuck.test/search?q={query}", Anchor);
        server.StreamSites.Hang("stuck.test");
        server.Feed.SetScoreboard(Nfl, LiveGame(server.Clock, "401"));
        await using var client = await server.ConnectClientAsync();
        Assert.Empty(Assert.Single(await client.NextSnapshotAsync()).StreamLinks);

        await server.StreamSearchesFinishedAsync();
    }

    [Fact]
    public async Task A_game_is_searched_again_only_after_its_result_has_been_cached_for_a_while()
    {
        await using var server = new ScoreMapServer();
        server.AddStreamSite("Streams One", "https://streams-one.test/search?q={query}", Anchor);
        server.StreamSites.Serve("streams-one.test", SearchPage);
        server.Feed.SetScoreboard(Nfl, LiveGame(server.Clock, "401"));
        await using var client = await server.ConnectClientAsync();
        await client.NextSnapshotAsync();
        await server.StreamSearchesFinishedAsync();

        for (var poll = 2; poll <= 5; poll++)
        {
            server.Clock.Advance(TimeSpan.FromSeconds(15));
            await server.Feed.WaitForFetchesAsync(Nfl, poll);
        }
        Assert.Single(server.StreamSites.Requests);

        server.Clock.Advance(TimeSpan.FromMinutes(10));
        await server.StreamSites.WaitForRequestsAsync(2);
    }

    [Fact]
    public async Task With_no_sites_configured_nothing_is_searched()
    {
        await using var server = new ScoreMapServer();
        server.Feed.SetScoreboard(Nfl, LiveGame(server.Clock, "401"));
        await using var client = await server.ConnectClientAsync();

        Assert.Empty(Assert.Single(await client.NextSnapshotAsync()).StreamLinks);
        Assert.Empty(server.StreamSites.Requests);
    }

    [Fact]
    public async Task A_final_game_is_not_searched()
    {
        await using var server = new ScoreMapServer();
        server.AddStreamSite("Streams One", "https://streams-one.test/search?q={query}", Anchor);
        server.StreamSites.Serve("streams-one.test", SearchPage);
        server.Feed.SetScoreboard(Nfl, Game("401", Nfl, server.Clock.GetUtcNow().AddHours(-3),
            ScoreMap.Server.GameFeed.ProviderStatus.Final, 24, 21, null, null));
        await using var client = await server.ConnectClientAsync();
        await client.NextSnapshotAsync();

        await server.StreamSearchesFinishedAsync();
        Assert.Empty(server.StreamSites.Requests);
    }
}
