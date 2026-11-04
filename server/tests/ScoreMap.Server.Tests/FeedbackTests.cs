using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using ScoreMap.Server.Feedback;
using ScoreMap.Server.GameFeed;
using ScoreMap.Server.Games;
using ScoreMap.Server.Scenarios;
using ScoreMap.Server.Tests.Support;
using ScoreMap.Server.Venues;
using static ScoreMap.Server.Tests.Support.TestGames;

namespace ScoreMap.Server.Tests;

/// <summary>
/// Feedback from the Feedback button: the server files it as an issue in the repo with the owner's
/// token, or with no token only logs it, behind the guards on length, visitors, the day and bots.
/// </summary>
public class FeedbackTests
{
    private const string Repo = "https://api.github.com/repos/phillipbritain/ScoreMap/issues";

    private const string Chrome =
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36";

    private static readonly object WideScreen = new { screenWidth = 1440, screenHeight = 900, phoneLayout = false };

    private static async Task<HttpResponseMessage> SendAsync(WebApplicationFactory<Program> server, string text, object? context = null,
        string? website = null, string visitor = "203.0.113.7", string userAgent = Chrome)
    {
        using var http = server.CreateClient();
        using var request = new HttpRequestMessage(HttpMethod.Post, "/api/feedback")
        {
            Content = JsonContent.Create(new { text, website, context = context ?? WideScreen }),
        };
        request.Headers.Add("X-Forwarded-For", visitor);
        request.Headers.TryAddWithoutValidation("User-Agent", userAgent);
        return await http.SendAsync(request);
    }

    private static async Task<FeedbackEndpoints.FeedbackReply> ReplyAsync(HttpResponseMessage response) =>
        (await response.Content.ReadFromJsonAsync<FeedbackEndpoints.FeedbackReply>())!;

    [Fact]
    public async Task Preparation_failures_return_both_the_visitors_and_the_days_allowance()
    {
        await using var server = new ScoreMapServer { FeedbackToken = "token" };
        var options = new FailingLeagues();
        await using var app = server.WithWebHostBuilder(builder => builder.ConfigureTestServices(services =>
            services.AddSingleton<IOptions<List<League>>>(options)));
        using var client = app.CreateClient();
        options.Fail = true;

        for (var i = 0; i < FeedbackGuard.PerVisitorLimit; i++)
            Assert.Equal(HttpStatusCode.InternalServerError, (await SendAsync(app, "Preparation will fail")).StatusCode);
        Assert.Empty(server.GitHub.Issues);
        options.Fail = false;

        for (var i = 0; i < FeedbackGuard.PerVisitorLimit; i++)
            Assert.Equal(HttpStatusCode.OK, (await SendAsync(app, "Preparation works again")).StatusCode);
        for (var i = FeedbackGuard.PerVisitorLimit; i < FeedbackGuard.DailyCap; i++)
            Assert.Equal(HttpStatusCode.OK, (await SendAsync(app, "Still room for feedback", visitor: $"203.0.113.{i + 20}")).StatusCode);
        Assert.Equal(FeedbackGuard.DailyCap, server.GitHub.Issues.Count);
        Assert.Equal(HttpStatusCode.TooManyRequests, (await SendAsync(app, "The day is now full")).StatusCode);
    }

    private sealed class FailingLeagues : IOptions<List<League>>
    {
        public bool Fail { get; set; }
        public List<League> Value => Fail ? throw new InvalidOperationException("Cannot prepare context") : [];
    }

    [Fact]
    public async Task A_snapshot_stays_unchanged_while_the_next_league_scoreboard_is_fetched()
    {
        await using var server = new ScoreMapServer();
        var board = server.Services.GetRequiredService<GameBoard>();
        var league = board.Leagues.Single(l => l.Key == Nfl);
        server.Feed.SetScoreboard(Nfl, LiveGame(server.Clock, "before"));
        board.UpdateLeague(league, await board.FetchLeagueAsync(league, CancellationToken.None));
        var snapshot = board.Games;
        server.Feed.SetScoreboard(Nfl, LiveGame(server.Clock, "after-1"), LiveGame(server.Clock, "after-2"));
        server.Feed.HoldUntilReleased(Nfl);
        var fetch = board.FetchLeagueAsync(league, CancellationToken.None);
        try
        {
            await server.Feed.WaitForFetchesAsync(Nfl, 2);
            Assert.False(fetch.IsCompleted);
            Assert.Equal(["before"], board.Games.Select(g => g.Id));
        }
        finally
        {
            server.Feed.Release(Nfl);
        }
        board.UpdateLeague(league, await fetch.WaitAsync(TimeSpan.FromSeconds(10)));
        Assert.Equal(["after-1", "after-2"], board.Games.Select(g => g.Id));
        Assert.Equal(["before"], snapshot.Select(g => g.Id));
    }

    [Fact]
    public async Task Venue_enrichment_publishes_a_new_snapshot_without_changing_the_previous_one()
    {
        await using var server = new ScoreMapServer();
        var board = server.Services.GetRequiredService<GameBoard>();
        var league = board.Leagues.Single(l => l.Key == Nfl);
        var requested = LiveGame(server.Clock, "game");
        board.UpdateLeague(league, [requested]);
        var snapshot = board.Games;
        var before = Assert.Single(snapshot);
        var location = new VenueLocation(new Coordinates(51.6043, -0.0664), LocationSource.Venue);

        board.UpdateVenue(league, requested, location);

        var enriched = Assert.Single(board.Games);
        Assert.Equal((51.6043, -0.0664), (enriched.Venue.Latitude, enriched.Venue.Longitude));
        Assert.Equal(before with { Venue = enriched.Venue }, enriched);
        Assert.Same(before, Assert.Single(snapshot));
        Assert.NotEqual(before.Venue, enriched.Venue);
    }

    [Fact]
    public async Task Top_events_publish_a_complete_snapshot_in_league_order_and_leave_previous_snapshots_unchanged()
    {
        await using var server = new ScoreMapServer();
        var board = server.Services.GetRequiredService<GameBoard>();
        var league = board.Leagues.Single(l => l.Key == Nfl);
        var other = new League { Key = "test/other", Name = "Other", Sport = Sport.Football };
        board.UpdateLeague(league, [LiveGame(server.Clock, "first"), LiveGame(server.Clock, "second")]);
        board.UpdateLeague(other, [LiveGame(server.Clock, "third", leagueKey: other.Key)]);
        var snapshot = board.Games;

        board.UpdateTopEvents(new HashSet<string> { "first", "third" }, new HashSet<string> { league.Key, other.Key });

        Assert.Equal(["first", "second", "third"], board.Games.Select(g => g.Id));
        Assert.Equal([true, false, true], board.Games.Select(g => g.TopEvent));
        Assert.All(snapshot, g => Assert.False(g.TopEvent));
        var marked = board.Games;
        board.UpdateTopEvents(new HashSet<string>(), new HashSet<string> { league.Key, other.Key });
        Assert.All(board.Games, g => Assert.False(g.TopEvent));
        Assert.Equal([true, false, true], marked.Select(g => g.TopEvent));
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task Feedback_reads_complete_leagues_while_updates_publish_and_GitHub_is_pending(bool demo)
    {
        await using var server = new ScoreMapServer { FeedbackToken = "token" };
        server.WriteScenario(DemoBoard.Scenario, ScenarioGame("demo-game"));
        var sink = new WaitingSink();
        await using var app = server.WithWebHostBuilder(builder => builder.ConfigureTestServices(services =>
            services.AddSingleton<IFeedbackSink>(sink)));
        using var client = app.CreateClient();
        var demoBoard = app.Services.GetRequiredService<DemoBoard>();
        var run = demo ? demoBoard.Join("feedback-test") : null;
        var board = run?.Board ?? app.Services.GetRequiredService<GameBoard>();
        if (run is not null)
            await run.Poller.SendSnapshotAsync(_ => Task.CompletedTask, CancellationToken.None);
        else
        {
            server.Feed.SetScoreboard(Nfl, LiveGame(server.Clock, "real-game"));
            var league = board.Leagues.Single(l => l.Key == Nfl);
            board.UpdateLeague(league, await board.FetchLeagueAsync(league, CancellationToken.None));
        }
        var gameId = demo ? "demo-game" : "real-game";
        // Empty scoreboards need no outside lookups, and each new key exercises league insertion.
        var start = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var writer = Task.Run(async () =>
        {
            await start.Task;
            for (var i = 0; i < 2000; i++)
                board.UpdateLeague(new League { Key = $"test/{i}", Name = $"League {i}", Sport = Sport.Football }, []);
        });
        var reader = Task.Run(async () =>
        {
            await start.Task;
            for (var i = 0; i < 2000; i++)
            {
                var games = demo ? demoBoard.Games : board.Games;
                Assert.Equal([gameId], games.Select(g => g.Id));
            }
        });
        var submission = SendAsync(app, "Feedback during league updates", new { demo, gameId });
        try
        {
            await sink.Entered.Task.WaitAsync(TimeSpan.FromSeconds(10));
            Assert.Contains($"Open game:** NFL, {(demo ? "scenario" : "ESPN")} game {gameId}", sink.Issue!.Body);
            start.SetResult();
            // Both board reads and updates must finish before the external request is released.
            await Task.WhenAll(writer, reader).WaitAsync(TimeSpan.FromSeconds(10));
            Assert.False(submission.IsCompleted);
        }
        finally
        {
            start.TrySetResult();
            sink.Release.TrySetResult();
            if (demo)
                demoBoard.Leave("feedback-test");
        }
        Assert.Equal(HttpStatusCode.OK, (await submission).StatusCode);
    }

    private sealed class WaitingSink : IFeedbackSink
    {
        public FeedbackIssue? Issue { get; private set; }
        public TaskCompletionSource Entered { get; } = new(TaskCreationOptions.RunContinuationsAsynchronously);
        public TaskCompletionSource Release { get; } = new(TaskCreationOptions.RunContinuationsAsynchronously);
        public async Task<Uri> FileAsync(FeedbackIssue issue, CancellationToken cancellationToken)
        {
            Issue = issue;
            Entered.SetResult();
            await Release.Task.WaitAsync(cancellationToken);
            return new Uri("https://github.com/phillipbritain/ScoreMap/issues/300");
        }
    }

    [Fact]
    public async Task With_a_token_feedback_is_filed_as_a_needs_triage_issue_and_the_reply_links_to_it()
    {
        await using var server = new ScoreMapServer { FeedbackToken = "github_pat_test" };

        var response = await SendAsync(server, "The scores in the NFL are slow to update tonight");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var issue = Assert.Single(server.GitHub.Issues);
        Assert.Equal(Repo, issue.Url.AbsoluteUri);
        Assert.Equal("Bearer github_pat_test", issue.Authorization);
        Assert.Equal(["needs-triage", "feedback"], issue.Labels);
        Assert.Equal("https://github.com/phillipbritain/ScoreMap/issues/300", (await ReplyAsync(response)).IssueUrl);
    }

    [Fact]
    public async Task The_issue_is_titled_with_the_start_of_the_text_cut_at_a_word()
    {
        await using var server = new ScoreMapServer { FeedbackToken = "token" };

        await SendAsync(server, "Short and sweet");
        await SendAsync(server, "When I open a game on my phone the panel covers\n\nmost of the globe and I can't see the pins behind it");

        Assert.Equal(["Short and sweet", "When I open a game on my phone the panel covers most of the…"],
            server.GitHub.Issues.Select(i => i.Title));
    }

    [Fact]
    public async Task The_text_is_fenced_off_so_it_cannot_mention_link_or_break_the_issue()
    {
        await using var server = new ScoreMapServer { FeedbackToken = "token" };
        const string text = "Hey @octocat see #12\n```\n# Not a heading\n````` and more";

        await SendAsync(server, text);

        var body = Assert.Single(server.GitHub.Issues).Body;
        // Longer than the longest run of backticks in the text, so nothing in it closes the fence.
        Assert.StartsWith($"``````text\n{text}\n``````\n", body);
        var title = Assert.Single(server.GitHub.Issues).Title;
        Assert.DoesNotContain("@octocat", title, StringComparison.Ordinal);
        Assert.DoesNotContain("#12", title, StringComparison.Ordinal);
    }

    [Fact]
    public async Task The_context_says_the_version_screen_browser_open_game_and_leagues_showing()
    {
        await using var server = new ScoreMapServer { FeedbackToken = "token" };
        server.Feed.SetScoreboard(Nfl, LiveGame(server.Clock, "401772"));
        await server.SnapshotOnceAsync();

        await SendAsync(server, "This game's clock is stuck", new
        {
            screenWidth = 390, screenHeight = 844, phoneLayout = true, gameId = "401772",
            leagues = new[] { "NBA", "NFL", "Not a league" }, topEventsOnly = false,
        }, userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1");

        var body = Assert.Single(server.GitHub.Issues).Body;
        Assert.EndsWith(
            "### Context\n\n" +
            $"- **Version:** {FeedbackIssue.AppVersion}\n" +
            "- **Screen:** 390 × 844, phone layout\n" +
            "- **Browser:** Safari 18 on iOS\n" +
            "- **Open game:** NFL, ESPN game 401772\n" +
            // In the configured order, and only the configured leagues.
            "- **Leagues showing:** NFL, NBA\n", body);
    }

    [Fact]
    public async Task Feedback_from_a_demo_says_so_and_names_its_open_game_as_the_demos()
    {
        await using var server = new ScoreMapServer { FeedbackToken = "token" };
        server.WriteScenario(DemoBoard.Scenario, ScenarioGame("demo-game"));
        server.Feed.SetScoreboard(Nfl, LiveGame(server.Clock, "real-game"));
        await server.SnapshotOnceAsync();
        await using var demo = await server.ConnectClientAsync(demo: true);
        await demo.NextSnapshotAsync();

        await SendAsync(server, "Is this game real?", new { screenWidth = 1440, screenHeight = 900, gameId = "demo-game", demo = true });
        await SendAsync(server, "Is this one real?", new { screenWidth = 1440, screenHeight = 900, gameId = "real-game", demo = true });

        var issues = server.GitHub.Issues;
        Assert.Contains("- **Demo:** made-up games from the worldwide scenario\n", issues[0].Body);
        Assert.Contains("- **Open game:** NFL, scenario game demo-game\n", issues[0].Body);
        // Only the demo's games are open in a demo.
        Assert.Contains("- **Demo:** made-up games from the worldwide scenario\n", issues[1].Body);
        Assert.DoesNotContain("Open game", issues[1].Body);
    }

    [Fact]
    public async Task Feedback_from_the_real_games_names_no_demo_and_no_demo_game()
    {
        await using var server = new ScoreMapServer { FeedbackToken = "token" };
        server.WriteScenario(DemoBoard.Scenario, ScenarioGame("demo-game"));
        await using var demo = await server.ConnectClientAsync(demo: true);
        await demo.NextSnapshotAsync();

        await SendAsync(server, "Is this game real?", new { screenWidth = 1440, screenHeight = 900, gameId = "demo-game" });

        var body = Assert.Single(server.GitHub.Issues).Body;
        Assert.DoesNotContain("Demo", body);
        Assert.DoesNotContain("Open game", body);
    }

    private static string ScenarioGame(string id) => $$"""
        {
          "games": [
            {
              "id": "{{id}}",
              "league": "NFL",
              "home": { "name": "Kansas City Chiefs", "abbreviation": "KC", "score": 14 },
              "away": { "name": "Buffalo Bills", "abbreviation": "BUF", "score": 10 },
              "venue": { "name": "Arrowhead Stadium", "city": "Kansas City", "region": "MO", "country": "USA" },
              "startsIn": "-40m",
              "status": "live"
            }
          ]
        }
        """;

    [Theory]
    [InlineData(true, null, "Top Events only")]
    [InlineData(false, null, "All leagues")]
    [InlineData(false, new string[0], "None")]
    public async Task The_context_names_top_events_or_all_leagues_or_none(bool topEventsOnly, string[]? leagues, string showing)
    {
        await using var server = new ScoreMapServer { FeedbackToken = "token" };
        // Every configured league, unless the case lists some.
        using var http = server.CreateClient();
        var all = (await http.GetFromJsonAsync<List<LeagueName>>("/api/leagues"))!.Select(l => l.Name).ToArray();

        await SendAsync(server, "Which leagues am I seeing?", new
        {
            screenWidth = 1440, screenHeight = 900, phoneLayout = false, leagues = leagues ?? all, topEventsOnly,
        });

        var body = Assert.Single(server.GitHub.Issues).Body;
        Assert.Contains($"- **Leagues showing:** {showing}\n", body);
        Assert.Contains("- **Screen:** 1440 × 900, wide layout\n", body);
        Assert.Contains("- **Browser:** Chrome 141 on Windows\n", body);
        Assert.DoesNotContain("Open game", body);
    }

    private sealed record LeagueName(string Name);

    [Fact]
    public async Task The_issue_leaves_out_the_visitors_address_and_anything_the_browser_made_up()
    {
        await using var server = new ScoreMapServer { FeedbackToken = "token" };

        await SendAsync(server, "Nothing about me please", new
        {
            screenWidth = 1440, screenHeight = 900, phoneLayout = false, gameId = "@octocat", leagues = new[] { "@octocat" },
            timeZone = "Europe/London",
        }, visitor: "198.51.100.23", userAgent: "@octocat/1.0 #12");

        var body = Assert.Single(server.GitHub.Issues).Body;
        Assert.DoesNotContain("198.51.100.23", body);
        Assert.DoesNotContain("London", body);
        Assert.DoesNotContain("octocat", body);
        Assert.DoesNotContain("#12", body);
        Assert.DoesNotContain("Open game", body);
        Assert.Contains("- **Browser:** Unknown\n", body);
    }

    [Theory]
    [InlineData("too short")]
    [InlineData("          a     ")]
    public async Task Feedback_under_10_characters_is_refused(string text)
    {
        await using var server = new ScoreMapServer { FeedbackToken = "token" };

        var response = await SendAsync(server, text);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.NotNull((await ReplyAsync(response)).Error);
        Assert.Empty(server.GitHub.Issues);
    }

    [Fact]
    public async Task Feedback_of_2000_characters_is_filed_and_over_that_refused()
    {
        await using var server = new ScoreMapServer { FeedbackToken = "token" };

        var longest = await SendAsync(server, new string('a', 2000));
        var tooLong = await SendAsync(server, new string('a', 2001));

        Assert.Equal(HttpStatusCode.OK, longest.StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, tooLong.StatusCode);
        Assert.Single(server.GitHub.Issues);
    }

    [Fact]
    public async Task With_no_token_the_issue_is_logged_not_posted_and_the_reply_has_a_dummy_link()
    {
        await using var server = new ScoreMapServer();

        var response = await SendAsync(server, "Lovely globe, thank you");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(LoggedFeedbackSink.DummyIssueUrl.AbsoluteUri, (await ReplyAsync(response)).IssueUrl);
        Assert.Empty(server.GitHub.Issues);
        var logged = Assert.Single(server.Logs.Entries, e => e.Message.Contains("Lovely globe, thank you"));
        Assert.Contains("### Context", logged.Message);
    }

    [Fact]
    public async Task A_fourth_submission_from_one_visitor_in_10_minutes_is_refused_but_others_can_still_send()
    {
        await using var server = new ScoreMapServer { FeedbackToken = "token" };

        for (var i = 0; i < 3; i++)
            Assert.Equal(HttpStatusCode.OK, (await SendAsync(server, $"Feedback number {i}")).StatusCode);
        var fourth = await SendAsync(server, "Feedback number 3");
        var someoneElse = await SendAsync(server, "Feedback from elsewhere", visitor: "198.51.100.23");
        server.Clock.Advance(TimeSpan.FromMinutes(10));
        var later = await SendAsync(server, "Feedback number 4");

        Assert.Equal(HttpStatusCode.TooManyRequests, fourth.StatusCode);
        Assert.NotNull((await ReplyAsync(fourth)).Error);
        Assert.Equal(HttpStatusCode.OK, someoneElse.StatusCode);
        Assert.Equal(HttpStatusCode.OK, later.StatusCode);
        Assert.Equal(5, server.GitHub.Issues.Count);
    }

    [Fact]
    public async Task After_20_issues_in_a_day_feedback_is_closed_until_the_next_day()
    {
        await using var server = new ScoreMapServer { FeedbackToken = "token" };

        for (var i = 0; i < 20; i++)
            Assert.Equal(HttpStatusCode.OK, (await SendAsync(server, $"Feedback number {i}", visitor: $"203.0.113.{i}")).StatusCode);
        var closed = await SendAsync(server, "One too many today", visitor: "198.51.100.23");
        server.Clock.Advance(TimeSpan.FromDays(1));
        var tomorrow = await SendAsync(server, "A new day, a new note", visitor: "198.51.100.24");

        Assert.Equal(HttpStatusCode.TooManyRequests, closed.StatusCode);
        Assert.Equal("Feedback is closed for today, try tomorrow", (await ReplyAsync(closed)).Error);
        Assert.Equal(HttpStatusCode.OK, tomorrow.StatusCode);
        Assert.Equal(21, server.GitHub.Issues.Count);
    }

    [Fact]
    public async Task Once_feedback_is_closed_for_today_every_try_from_a_visitor_is_told_so()
    {
        await using var server = new ScoreMapServer { FeedbackToken = "token" };
        for (var i = 0; i < 20; i++)
            await SendAsync(server, $"Feedback number {i}", visitor: $"203.0.113.{i}");

        for (var i = 0; i < 4; i++)
        {
            var closed = await SendAsync(server, "Still trying today", visitor: "198.51.100.23");
            Assert.Equal("Feedback is closed for today, try tomorrow", (await ReplyAsync(closed)).Error);
        }
    }

    [Fact]
    public async Task Feedback_GitHub_failed_to_file_does_not_count_towards_the_visitors_limit()
    {
        await using var server = new ScoreMapServer { FeedbackToken = "token" };
        server.GitHub.Fail(HttpStatusCode.InternalServerError);
        for (var i = 0; i < 3; i++)
            await SendAsync(server, "Trying while GitHub is down");
        server.GitHub.Answer();

        var response = await SendAsync(server, "GitHub is back");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task Feedback_with_the_honeypot_filled_in_gets_thanks_but_no_issue()
    {
        await using var server = new ScoreMapServer { FeedbackToken = "token" };

        var response = await SendAsync(server, "Buy cheap watches now", website: "https://spam.example");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.NotNull((await ReplyAsync(response)).IssueUrl);
        Assert.Empty(server.GitHub.Issues);
    }

    [Theory]
    [InlineData(HttpStatusCode.InternalServerError)]
    [InlineData(HttpStatusCode.Forbidden)]
    public async Task When_GitHub_refuses_the_issue_the_reply_is_a_short_error(HttpStatusCode status)
    {
        await using var server = new ScoreMapServer { FeedbackToken = "token" };
        server.GitHub.Fail(status);

        var response = await SendAsync(server, "This won't get through");

        Assert.Equal(HttpStatusCode.BadGateway, response.StatusCode);
        Assert.NotNull((await ReplyAsync(response)).Error);
    }

    [Fact]
    public async Task When_GitHub_does_not_answer_the_reply_is_a_short_error()
    {
        await using var server = new ScoreMapServer { FeedbackToken = "token", FeedbackTimeout = TimeSpan.FromMilliseconds(100) };
        server.GitHub.Hang();

        var response = await SendAsync(server, "This won't get through");

        Assert.Equal(HttpStatusCode.BadGateway, response.StatusCode);
        Assert.NotNull((await ReplyAsync(response)).Error);
    }

    [Fact]
    public async Task Feedback_GitHub_failed_to_file_does_not_count_towards_the_day()
    {
        await using var server = new ScoreMapServer { FeedbackToken = "token" };
        server.GitHub.Fail(HttpStatusCode.InternalServerError);
        for (var i = 0; i < 20; i++)
            await SendAsync(server, $"Feedback number {i}", visitor: $"203.0.113.{i}");
        server.GitHub.Answer();

        var response = await SendAsync(server, "GitHub is back", visitor: "198.51.100.23");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task A_visitor_who_gives_up_waiting_files_nothing_and_breaks_nothing()
    {
        await using var server = new ScoreMapServer { FeedbackToken = "token" };
        server.GitHub.Hang();
        using var http = server.CreateClient();
        using var cancel = new CancellationTokenSource(TimeSpan.FromMilliseconds(100));

        await Assert.ThrowsAnyAsync<OperationCanceledException>(() => http.PostAsJsonAsync(
            "/api/feedback", new { text = "I'll go elsewhere", context = WideScreen }, cancel.Token));

        Assert.Empty(server.Logs.Errors);
    }
}
