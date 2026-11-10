using System.Text.Json;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Time.Testing;
using ScoreMap.Server.GameFeed;
using ScoreMap.Server.Tests.Scenarios;
using ScoreMap.Server.Tests.Support;

namespace ScoreMap.Server.Tests.GameFeed;

/// <summary>
/// Runs a saved real ESPN IndyCar scoreboard (the 2026 Grand Prix of Monterey) through the adapter. ESPN gives
/// no venue for an IndyCar race anywhere, so it comes from the checked-in track list, by the race's name; a race
/// missing from it has no pin, so it's left out.
/// </summary>
public sealed class EspnIndyCarTests : IDisposable
{
    private const string IndyCar = "racing/irl";
    private const string Scoreboard = "https://espn.test/sports/racing/irl/scoreboard";

    private static readonly Coordinates LagunaSeca = new(36.5844, -121.7534);

    private readonly string _folder = Path.Combine(Path.GetTempPath(), $"scoremap-espn-indycar-{Guid.NewGuid():N}");
    private readonly CapturedLogs _logs = new();

    public EspnIndyCarTests() => Directory.CreateDirectory(_folder);

    public void Dispose()
    {
        if (Directory.Exists(_folder))
            Directory.Delete(_folder, recursive: true);
    }

    private string TracksPath => Path.Combine(_folder, "indycar-tracks.json");

    private static string Fixture(string name) =>
        File.ReadAllText(Path.Combine(AppContext.BaseDirectory, "Fixtures", "Espn", name));

    private static StubHttpHandler Monterey() => StubHttpHandler.Serving((Scoreboard, Fixture("indycar-final.json")));

    private EspnGameFeedProvider ProviderOver(StubHttpHandler handler, string tracksJson) => ProviderOver(handler, Tracks(tracksJson));

    private EspnGameFeedProvider ProviderOver(StubHttpHandler handler, TrackList tracks) => new(
        new HttpClient(handler) { BaseAddress = new Uri("https://espn.test/sports/") },
        new FakeTimeProvider(new DateTimeOffset(2026, 9, 6, 22, 0, 0, TimeSpan.Zero)),
        Path.Combine(_folder, "event-venues.json"),
        tracks);

    private TrackList Tracks(string json)
    {
        File.WriteAllText(TracksPath, json);
        return new TrackList(TracksPath, _logs.CreateLogger("tracks"));
    }

    private const string WithMonterey = """
        {
          "Grand Prix of Monterey": {
            "name": "WeatherTech Raceway Laguna Seca", "city": "Monterey", "region": "CA", "country": "USA",
            "latitude": 36.5844, "longitude": -121.7534
          }
        }
        """;

    private const string WithoutMonterey = """
        {
          "Grand Prix of Long Beach": {
            "name": "Streets of Long Beach", "city": "Long Beach", "region": "CA", "country": "USA",
            "latitude": 33.7650, "longitude": -118.1890
          }
        }
        """;

    [Fact]
    public async Task A_race_is_one_game_with_its_drivers_in_order_its_last_lap_and_its_name()
    {
        var game = Assert.Single(await ProviderOver(Monterey(), WithMonterey).FetchScoreboardAsync(IndyCar, CancellationToken.None));

        Assert.Equal("202609061784", game.Id);
        Assert.Equal(ProviderStatus.Final, game.Status);
        Assert.Equal(95, game.Period);
        Assert.Equal("Grand Prix of Monterey", game.Note);
        var field = Assert.IsType<ProviderField>(game.Contest);
        Assert.Equal(Enumerable.Range(1, 25), field.Entries.Select(entrant => entrant.Position));
        Assert.Equal(
            new ProviderEntrant(1, "Scott McLaughlin", "S. McLaughlin", "https://a.espncdn.com/i/teamlogos/countries/500/nzl.png"),
            field.Entries[0]);
    }

    [Fact]
    public async Task A_race_in_the_track_list_is_at_its_track_without_asking_the_core_api()
    {
        var handler = Monterey();

        var game = Assert.Single(await ProviderOver(handler, WithMonterey).FetchScoreboardAsync(IndyCar, CancellationToken.None));

        Assert.Equal(new ProviderVenue("WeatherTech Raceway Laguna Seca", "Monterey", "CA", "USA", Location: LagunaSeca), game.Venue);
        Assert.DoesNotContain(handler.Requests, request => request.RequestUri!.Host == "sports.core.api.espn.com");
        Assert.Empty(_logs.Entries);
    }

    [Fact]
    public async Task A_race_missing_from_the_track_list_is_left_out_and_logged_by_name_once()
    {
        var handler = Monterey();
        var provider = ProviderOver(handler, WithoutMonterey);

        await provider.FetchScoreboardAsync(IndyCar, CancellationToken.None);
        var games = await provider.FetchScoreboardAsync(IndyCar, CancellationToken.None);

        Assert.Empty(games);
        var logged = Assert.Single(_logs.Entries);
        Assert.Equal(LogLevel.Warning, logged.Level);
        Assert.Contains("Grand Prix of Monterey", logged.Message, StringComparison.Ordinal);
        Assert.DoesNotContain(handler.Requests, request => request.RequestUri!.Host == "sports.core.api.espn.com");
    }

    [Fact]
    public async Task A_race_added_to_the_track_list_gets_its_venue_without_a_restart()
    {
        var tracks = Tracks(WithoutMonterey);
        var provider = ProviderOver(Monterey(), tracks);
        await provider.FetchScoreboardAsync(IndyCar, CancellationToken.None);

        await File.WriteAllTextAsync(TracksPath, WithMonterey, TestContext.Current.CancellationToken);
        File.SetLastWriteTimeUtc(TracksPath, DateTime.UtcNow.AddMinutes(1));
        var game = Assert.Single(await provider.FetchScoreboardAsync(IndyCar, CancellationToken.None));

        Assert.Equal("WeatherTech Raceway Laguna Seca", game.Venue?.Name);
    }

    [Fact]
    public async Task A_track_list_that_cant_be_read_leaves_every_race_out_and_is_logged()
    {
        var games = await ProviderOver(Monterey(), "{ not JSON").FetchScoreboardAsync(IndyCar, CancellationToken.None);

        Assert.Empty(games);
        Assert.Contains(_logs.Entries, entry => entry.Message.Contains(TracksPath, StringComparison.Ordinal));
    }

    [Fact]
    public void The_shipped_track_list_places_every_race_on_the_2026_calendar_in_north_america()
    {
        // The scoreboard's calendar lists the season's races by name.
        using var scoreboard = JsonDocument.Parse(Fixture("indycar-final.json"));
        var races = scoreboard.RootElement.GetProperty("leagues")[0].GetProperty("calendar").EnumerateArray()
            .Select(race => race.GetProperty("label").GetString()!)
            .ToList();
        var tracks = new TrackList(Path.Combine(ScenarioVenueListTests.ServerProjectFolder, "indycar-tracks.json"),
            _logs.CreateLogger("tracks"));

        Assert.Equal(18, races.Count);
        Assert.All(races, race =>
        {
            var venue = tracks.Find(race);
            Assert.True(venue is { Name: not null, City: not null, Location: not null }, $"{race} has no track");
            Assert.InRange(venue!.Location!.Latitude, 25, 50);
            Assert.InRange(venue.Location.Longitude, -125, -75);
        });
        Assert.Empty(_logs.Entries);
    }
}
