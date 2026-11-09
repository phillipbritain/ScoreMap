using Microsoft.Extensions.Time.Testing;
using ScoreMap.Server.GameFeed;
using ScoreMap.Server.Tests.Support;

namespace ScoreMap.Server.Tests.GameFeed;

/// <summary>Runs saved real ESPN NASCAR responses, the scoreboard and the core API's event and venue, through the adapter.</summary>
public sealed class EspnRacingTests : IDisposable
{
    private const string Nascar = "racing/nascar-premier";
    private const string Scoreboard = "https://espn.test/sports/racing/nascar-premier/scoreboard";
    private const string CoreEvent = "https://sports.core.api.espn.com/v2/sports/racing/leagues/nascar-premier/events/202610250041";
    private const string CoreVenue = "https://sports.core.api.espn.com/v2/sports/racing/leagues/nascar-premier/venues/15";

    private readonly string _folder = Path.Combine(Path.GetTempPath(), $"scoremap-espn-racing-{Guid.NewGuid():N}");

    private string SavedVenuesPath => Path.Combine(_folder, "event-venues.json");

    public void Dispose()
    {
        if (Directory.Exists(_folder))
            Directory.Delete(_folder, recursive: true);
    }

    private static string Fixture(string name) =>
        File.ReadAllText(Path.Combine(AppContext.BaseDirectory, "Fixtures", "Espn", name));

    private EspnGameFeedProvider ProviderOver(StubHttpHandler handler) => new(
        new HttpClient(handler) { BaseAddress = new Uri("https://espn.test/sports/") },
        new FakeTimeProvider(new DateTimeOffset(2026, 10, 25, 22, 0, 0, TimeSpan.Zero)),
        SavedVenuesPath);

    private static StubHttpHandler Talladega() => StubHttpHandler.Serving(
        (Scoreboard, Fixture("nascar-final.json")),
        (CoreEvent, Fixture("nascar-core-event.json")),
        (CoreVenue, Fixture("nascar-core-venue.json")));

    [Fact]
    public async Task A_race_is_one_game_with_its_field_in_order_and_its_last_lap()
    {
        var game = Assert.Single(await ProviderOver(Talladega()).FetchScoreboardAsync(Nascar, CancellationToken.None));

        Assert.Equal("202610250041", game.Id);
        Assert.Equal(ProviderStatus.Final, game.Status);
        Assert.Equal(189, game.Period);
        Assert.Null(game.DisplayClock);
        Assert.Equal("NASCAR Cup Series at Talladega", game.Note);
        var field = Assert.IsType<ProviderField>(game.Contest);
        Assert.Equal(40, field.Entries.Count);
        Assert.Equal(Enumerable.Range(1, 40), field.Entries.Select(entrant => entrant.Position));
        Assert.Equal(
            new ProviderEntrant(1, "Kyle Larson", "K. Larson", "https://a.espncdn.com/i/teamlogos/countries/500/usa.png"),
            field.Entries[0]);
        Assert.Equal("W. Byron", field.Entries[1].ShortName);
    }

    [Fact]
    public async Task A_race_is_at_its_venue_from_the_core_api_asked_for_once_and_saved_for_later_runs()
    {
        var first = Talladega();
        await ProviderOver(first).FetchScoreboardAsync(Nascar, CancellationToken.None);
        var game = Assert.Single(await ProviderOver(first).FetchScoreboardAsync(Nascar, CancellationToken.None));
        var later = StubHttpHandler.Serving((Scoreboard, Fixture("nascar-final.json")));
        var laterRace = Assert.Single(await ProviderOver(later).FetchScoreboardAsync(Nascar, CancellationToken.None));

        var talladega = new ProviderVenue("Talladega Superspeedway", "Talladega", "AL", "USA", "15");
        Assert.Equal(talladega, game.Venue);
        Assert.Equal(talladega, laterRace.Venue);
        Assert.Single(first.Requests, request => request.RequestUri!.AbsoluteUri.StartsWith(CoreEvent, StringComparison.Ordinal));
        Assert.DoesNotContain(later.Requests, request => request.RequestUri!.Host == "sports.core.api.espn.com");
    }

    public static TheoryData<string> VenueFailures => ["error status", "timeout", "not JSON"];

    [Theory]
    [MemberData(nameof(VenueFailures))]
    public async Task A_failed_venue_request_is_not_saved_and_is_tried_again(string failure)
    {
        var failing = new StubHttpHandler(request => request.RequestUri!.Host != "sports.core.api.espn.com"
            ? Fixture("nascar-final.json")
            : failure switch
            {
                "error status" => StubHttpHandler.ServerError,
                "timeout" => throw new TaskCanceledException("The request was canceled due to the configured HttpClient.Timeout of 10 seconds elapsing.",
                    new TimeoutException("The operation was canceled.")),
                _ => "<html>Service Unavailable</html>",
            });
        var game = Assert.Single(await ProviderOver(failing).FetchScoreboardAsync(Nascar, CancellationToken.None));

        var retried = Assert.Single(await ProviderOver(Talladega()).FetchScoreboardAsync(Nascar, CancellationToken.None));

        Assert.Null(game.Venue);
        Assert.Equal("Talladega Superspeedway", retried.Venue?.Name);
    }

    [Fact]
    public async Task Canceling_while_a_venue_is_asked_for_cancels_the_fetch()
    {
        using var cancel = new CancellationTokenSource();
        var handler = new StubHttpHandler(request =>
        {
            if (request.RequestUri!.Host != "sports.core.api.espn.com")
                return Fixture("nascar-final.json");
            cancel.Cancel();
            throw new TaskCanceledException("Canceled", null, cancel.Token);
        });

        await Assert.ThrowsAnyAsync<OperationCanceledException>(() => ProviderOver(handler).FetchScoreboardAsync(Nascar, cancel.Token));
    }

    [Fact]
    public async Task A_saved_venues_file_that_cant_be_read_is_started_afresh_and_venues_asked_for_again()
    {
        Directory.CreateDirectory(_folder);
        await File.WriteAllTextAsync(SavedVenuesPath, "{ not JSON");

        var game = Assert.Single(await ProviderOver(Talladega()).FetchScoreboardAsync(Nascar, CancellationToken.None));

        Assert.Equal("Talladega Superspeedway", game.Venue?.Name);
    }

    [Fact]
    public async Task A_venue_that_cant_be_saved_is_still_used_and_kept_until_the_server_restarts()
    {
        // A folder where the file should be, so saving it fails.
        Directory.CreateDirectory(SavedVenuesPath);
        var handler = Talladega();
        var provider = ProviderOver(handler);

        await provider.FetchScoreboardAsync(Nascar, CancellationToken.None);
        var game = Assert.Single(await provider.FetchScoreboardAsync(Nascar, CancellationToken.None));

        Assert.Equal("Talladega Superspeedway", game.Venue?.Name);
        Assert.Single(handler.Requests, request => request.RequestUri!.AbsoluteUri.StartsWith(CoreEvent, StringComparison.Ordinal));
    }

    [Fact]
    public async Task A_race_before_its_start_lists_no_field_and_no_lap()
    {
        var handler = StubHttpHandler.Serving((Scoreboard, Fixture("nascar.json")));

        var game = Assert.Single(await ProviderOver(handler).FetchScoreboardAsync(Nascar, CancellationToken.None));

        Assert.Equal(ProviderStatus.Scheduled, game.Status);
        Assert.Empty(Assert.IsType<ProviderField>(game.Contest).Entries);
        Assert.Null(game.Period);
        Assert.Equal("NASCAR Cup Series at Martinsville", game.Note);
    }
}
