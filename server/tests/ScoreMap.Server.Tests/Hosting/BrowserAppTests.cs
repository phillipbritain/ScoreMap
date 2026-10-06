using System.Net;
using ScoreMap.Server.Tests.Support;
using static ScoreMap.Server.Tests.Support.TestGames;

namespace ScoreMap.Server.Tests.Hosting;

/// <summary>In production the server serves the built browser app alongside the games hub.</summary>
public sealed class BrowserAppTests : IDisposable
{
    private const string IndexHtml = "<!doctype html><title>ScoreMap</title>";
    private const string Script = "console.log('globe')";

    private readonly string _browserApp = Directory.CreateTempSubdirectory("scoremap-wwwroot-").FullName;

    public BrowserAppTests()
    {
        File.WriteAllText(Path.Combine(_browserApp, "index.html"), IndexHtml);
        Directory.CreateDirectory(Path.Combine(_browserApp, "assets"));
        File.WriteAllText(Path.Combine(_browserApp, "assets", "index-abc123.js"), Script);
    }

    public void Dispose() => Directory.Delete(_browserApp, recursive: true);

    [Fact]
    public async Task The_browser_app_is_served_at_the_root()
    {
        await using var server = new ScoreMapServer { BrowserAppFolder = _browserApp };

        var response = await server.CreateClient().GetAsync("/");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("text/html", response.Content.Headers.ContentType?.MediaType);
        Assert.Equal(IndexHtml, await response.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task The_browser_apps_built_files_are_served()
    {
        await using var server = new ScoreMapServer { BrowserAppFolder = _browserApp };

        var response = await server.CreateClient().GetAsync("/assets/index-abc123.js");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(Script, await response.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task Any_other_page_address_gets_the_browser_app()
    {
        await using var server = new ScoreMapServer { BrowserAppFolder = _browserApp };

        var response = await server.CreateClient().GetAsync("/games/401872965");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(IndexHtml, await response.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task A_missing_file_is_not_found_rather_than_the_browser_app()
    {
        await using var server = new ScoreMapServer { BrowserAppFolder = _browserApp };

        var response = await server.CreateClient().GetAsync("/assets/index-gone.js");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task Browsers_still_reach_the_games_hub_alongside_the_browser_app()
    {
        await using var server = new ScoreMapServer { BrowserAppFolder = _browserApp };
        server.Feed.SetScoreboard(Nfl, LiveGame(server.Clock, "401"));

        await using var client = await server.ConnectClientAsync();

        Assert.Single(await client.NextSnapshotAsync());
    }
}
