using ScoreMap.Server.GameFeed;
using ScoreMap.Server.Tests.Support;
using static ScoreMap.Server.GameFeed.ProviderPeriodPhase;
using static ScoreMap.Server.GameFeed.ProviderStatus;

namespace ScoreMap.Server.Tests;

/// <summary>
/// Whether a connected client is told a basketball game is in clutch time (see GLOSSARY.md): the last 5
/// minutes of the last period of regulation, or any time in overtime, while the score is within 5 points.
/// </summary>
public class ClutchTimeTests
{
    private const string Nba = "basketball/nba";
    private const string NcaaMen = "basketball/mens-college-basketball?groups=50";

    [Theory]
    [InlineData("5:00", 100, 95, true)]
    [InlineData("4:59", 100, 96, true)]
    [InlineData("0:42", 98, 100, true)]
    [InlineData("12.4", 100, 100, true)]
    [InlineData("0.0", 101, 100, true)]
    [InlineData("5:01", 100, 100, false)]
    [InlineData("4:00", 100, 94, false)]
    [InlineData("2:00", 90, 100, false)]
    public async Task Last_five_minutes_of_the_fourth_quarter_within_five_points(string clock, int home, int away, bool expected) =>
        Assert.Equal(expected, await ClutchTimeAsync(Nba, InProgress, clock, period: 4, home, away));

    [Theory]
    [InlineData(1, "1:00")]
    [InlineData(3, "0:30")]
    public async Task Not_before_the_last_period_of_regulation(int period, string clock) =>
        Assert.False(await ClutchTimeAsync(Nba, InProgress, clock, period, 50, 50));

    [Theory]
    [InlineData(5, "4:59", 110, 106, true)]
    [InlineData(5, "5:00", 110, 110, true)]
    [InlineData(6, "1:30", 120, 125, true)]
    [InlineData(5, "3:00", 112, 105, false)]
    public async Task Any_time_in_overtime_within_five_points(int period, string clock, int home, int away, bool expected) =>
        Assert.Equal(expected, await ClutchTimeAsync(Nba, InProgress, clock, period, home, away));

    [Theory]
    [InlineData(2, "4:30", true)]
    [InlineData(1, "4:30", false)]
    [InlineData(3, "4:59", true)]
    public async Task Halves_count_the_second_half_as_the_last_period_of_regulation(int period, string clock, bool expected) =>
        Assert.Equal(expected, await ClutchTimeAsync(NcaaMen, InProgress, clock, period, 70, 68));

    [Fact]
    public async Task Not_once_the_game_is_final() =>
        Assert.False(await ClutchTimeAsync(Nba, Final, "0.0", period: 4, 100, 99));

    [Fact]
    public async Task Never_in_other_sports() =>
        Assert.False(await ClutchTimeAsync("football/nfl", InProgress, "2:00", period: 4, 21, 20));

    private static async Task<bool> ClutchTimeAsync(
        string leagueKey, ProviderStatus status, string clock, int period, int home, int away)
    {
        await using var server = new ScoreMapServer();
        server.Feed.SetScoreboard(leagueKey, new ProviderGame(
            Id: "1",
            LeagueKey: leagueKey,
            StartTime: server.Clock.GetUtcNow().AddHours(-2),
            Home: new ProviderTeam("HOM", "Home Team", null, home),
            Away: new ProviderTeam("AWY", "Away Team", null, away),
            Status: status,
            DisplayClock: clock,
            Period: period,
            Venue: new ProviderVenue("Arena", "City", null, "Country"),
            Broadcasters: [],
            Phase: Playing));

        await using var client = await server.ConnectClientAsync();
        return Assert.Single(await client.NextSnapshotAsync()).ClutchTime;
    }
}
