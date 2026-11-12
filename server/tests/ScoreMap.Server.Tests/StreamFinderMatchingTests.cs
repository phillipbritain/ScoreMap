using Microsoft.Extensions.DependencyInjection;
using ScoreMap.Server.Games;
using ScoreMap.Server.Tests.Support;
using ScoreMap.Server.WatchLinks;

namespace ScoreMap.Server.Tests;

/// <summary>The real finder over fake HTTP, exercised through the game board's link-source seam.</summary>
public class StreamFinderMatchingTests
{
    private const string PageUrl = "https://streams.test/";
    private const string GameUrl = "https://streams.test/watch/401";
    private const string Pattern = """<a href="(?<href>[^"]+)" data-league="(?<league>[^"]+)"(?: data-start="(?<start>[^"]*)")?>(?<first>[^<]+) vs (?<second>[^<]+)</a>""";

    private static StreamSite Site() => new()
    {
        Name = "Streams",
        SearchUrl = PageUrl,
        LinkPattern = Pattern,
        LeagueAliases = new() { ["NFL"] = ["nfl"], ["NCAA Football"] = ["cfb"] },
        TeamAliases = new()
        {
            ["NFL"] = new() { ["Kansas City Chiefs"] = ["KC Chiefs"] },
        },
    };

    private static string Listing(string first = "Kansas City Chiefs", string second = "Buffalo Bills",
        string league = "nfl", string? start = null, string url = GameUrl) =>
        $"<a href=\"{url}\" data-league=\"{league}\"{(start is null ? "" : $" data-start=\"{start}\"")}>{first} vs {second}</a>";

    private static Game GameFor(ScoreMapServer server, string id = "401", string home = "Kansas City Chiefs",
        string away = "Buffalo Bills", string league = "NFL") => new(
        Id: id, League: league, Sport: "Football", StartTime: server.Clock.GetUtcNow(),
        Status: GameStatus.Live, Delayed: false, EndTime: null,
        Contest: new GameSides(new GameTeam("H", home, null, "0"), new GameTeam("A", away, null, "0")),
        Clock: null, Period: null, ClutchTime: false, Hot: false,
        Venue: new GameVenue(null, null, null, null, null, null, null), StreamLinks: []);

    [Fact]
    public async Task Many_games_and_viewers_share_one_schedule_and_later_games_use_it_without_another_fetch()
    {
        await using var server = new ScoreMapServer();
        server.AddStreamSite(Site());
        server.StreamSites.Serve("streams.test", Listing() + Listing("Detroit Lions", "Carolina Panthers", url: "/watch/402"));
        var source = server.Services.GetRequiredService<IStreamLinkSource>();
        var game = GameFor(server);

        Parallel.For(0, 50, i => source.LinksFor(game with { Id = i.ToString() }));
        await server.StreamSearchesFinishedAsync();

        Assert.Equal([new StreamLink("Streams", GameUrl)], source.LinksFor(game));
        var later = GameFor(server, "402", "Detroit Lions", "Carolina Panthers");
        Assert.Equal([new StreamLink("Streams", "https://streams.test/watch/402")], source.LinksFor(later));
        Assert.Empty(source.LinksFor(GameFor(server, "403", "New York Jets", "Miami Dolphins")));
        Assert.Single(server.StreamSites.Requests);
    }

    [Fact]
    public async Task In_flight_and_failed_fetches_are_shared_instead_of_retrying_for_every_game()
    {
        await using var server = new ScoreMapServer { StreamSiteTimeout = TimeSpan.FromMilliseconds(100) };
        server.AddStreamSite(Site());
        server.StreamSites.Hang("streams.test");
        var source = server.Services.GetRequiredService<IStreamLinkSource>();

        for (var i = 0; i < 30; i++)
            Assert.Empty(source.LinksFor(GameFor(server, i.ToString())));
        await server.StreamSearchesFinishedAsync();
        for (var i = 30; i < 60; i++)
            Assert.Empty(source.LinksFor(GameFor(server, i.ToString())));

        Assert.Single(server.StreamSites.Requests);
        server.StreamSites.Serve("streams.test", Listing());
        server.Clock.Advance(TimeSpan.FromMinutes(10));
        Assert.Empty(source.LinksFor(GameFor(server)));
        await server.StreamSearchesFinishedAsync();
        Assert.Single(source.LinksFor(GameFor(server)));
        Assert.Equal(2, server.StreamSites.Requests.Count);
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task Expired_links_are_removed_and_a_failed_or_changed_schedule_does_not_keep_them(bool fail)
    {
        await using var server = new ScoreMapServer();
        server.AddStreamSite(Site());
        server.StreamSites.Serve("streams.test", Listing());
        var source = server.Services.GetRequiredService<IStreamLinkSource>();
        var game = GameFor(server);
        source.LinksFor(game);
        await server.StreamSearchesFinishedAsync();
        Assert.Single(source.LinksFor(game));

        if (fail) server.StreamSites.Fail("streams.test");
        else server.StreamSites.Serve("streams.test", "<ul></ul>");
        server.Clock.Advance(TimeSpan.FromMinutes(10));
        Assert.Empty(source.LinksFor(game));
        await server.StreamSearchesFinishedAsync();
        Assert.Empty(source.LinksFor(game));
        Assert.Equal(2, server.StreamSites.Requests.Count);
    }

    [Theory]
    [InlineData("Kansas City Chiefs", "Buffalo Bills", "nfl", true)]
    [InlineData("Buffalo Bills", "Kansas City Chiefs", "nfl", true)]
    [InlineData("KC Chiefs", "Buffalo Bills", "nfl", true)]
    [InlineData("Kánsas  City Chiefs", "BUFFALO BILLS", "nfl", true)]
    [InlineData("Kansas City Chiefs", "Buffalo Bills", "cfb", false)]
    [InlineData("Kansas City Chiefs", "Buffalo Bills", "unknown", false)]
    [InlineData("Chiefs", "Bills", "nfl", false)]
    [InlineData("Kansas City Chiefs", "Buffalo Bulls", "nfl", false)]
    [InlineData("Not Kansas City Chiefs", "Buffalo Bills", "nfl", false)]
    public async Task Both_complete_side_names_or_explicit_aliases_and_the_league_must_match(
        string first, string second, string league, bool expected)
    {
        await using var server = new ScoreMapServer();
        server.AddStreamSite(Site());
        server.StreamSites.Serve("streams.test", Listing(first, second, league));
        var source = server.Services.GetRequiredService<IStreamLinkSource>();
        var game = GameFor(server);
        source.LinksFor(game);
        await server.StreamSearchesFinishedAsync();

        Assert.Equal(expected ? [new StreamLink("Streams", GameUrl)] : [], source.LinksFor(game));
    }

    [Fact]
    public async Task Shared_nicknames_and_aliases_from_another_league_do_not_identify_a_side()
    {
        await using var server = new ScoreMapServer();
        server.AddStreamSite(Site());
        server.StreamSites.Serve("streams.test",
            Listing("Georgia Bulldogs", "Mississippi State Bulldogs", "cfb")
            + Listing("KC Chiefs", "Buffalo Bills", "cfb"));
        var source = server.Services.GetRequiredService<IStreamLinkSource>();
        var game = GameFor(server, home: "Georgia Bulldogs", away: "Fresno State Bulldogs", league: "NCAA Football");
        source.LinksFor(game);
        await server.StreamSearchesFinishedAsync();

        Assert.Empty(source.LinksFor(game));
        Assert.Empty(source.LinksFor(GameFor(server, league: "NCAA Football")));
    }

    [Theory]
    [InlineData("2026-10-04T18:00:00Z", true)]
    [InlineData("2026-10-04T14:00:00-04:00", true)]
    [InlineData("2026-10-04T18:30:00Z", true)]
    [InlineData("2026-10-04T18:31:00Z", false)]
    [InlineData("2026-10-05T18:00:00Z", false)]
    [InlineData("2026-10-04T18:00:00", false)]
    [InlineData("tomorrow", false)]
    [InlineData(null, true)]
    public async Task Absolute_start_times_must_be_valid_and_within_thirty_minutes_of_the_game(string? start, bool expected)
    {
        await using var server = new ScoreMapServer();
        server.AddStreamSite(Site());
        server.StreamSites.Serve("streams.test", Listing(start: start));
        var source = server.Services.GetRequiredService<IStreamLinkSource>();
        var game = GameFor(server);
        source.LinksFor(game);
        await server.StreamSearchesFinishedAsync();

        Assert.Equal(expected ? [new StreamLink("Streams", GameUrl)] : [], source.LinksFor(game));
    }

    [Theory]
    [InlineData(GameUrl, true)]
    [InlineData("/watch/another-game", false)]
    public async Task Repeated_anchors_are_deduplicated_but_multiple_matching_games_are_omitted(string secondUrl, bool expected)
    {
        await using var server = new ScoreMapServer();
        server.AddStreamSite(Site());
        server.StreamSites.Serve("streams.test", Listing() + Listing(url: secondUrl));
        var source = server.Services.GetRequiredService<IStreamLinkSource>();
        var game = GameFor(server);
        source.LinksFor(game);
        await server.StreamSearchesFinishedAsync();

        Assert.Equal(expected ? [new StreamLink("Streams", GameUrl)] : [], source.LinksFor(game));
    }

    [Theory]
    [InlineData("javascript:alert(1)")]
    [InlineData("https://other.test/watch/401")]
    [InlineData("https://streams.test@other.test/watch/401")]
    [InlineData("https://user@streams.test/watch/401")]
    public async Task Only_web_links_on_the_configured_site_are_accepted(string url)
    {
        await using var server = new ScoreMapServer();
        server.AddStreamSite(Site());
        server.StreamSites.Serve("streams.test", Listing(url: url));
        var source = server.Services.GetRequiredService<IStreamLinkSource>();
        var game = GameFor(server);
        source.LinksFor(game);
        await server.StreamSearchesFinishedAsync();

        Assert.Empty(source.LinksFor(game));
    }
}
