using ScoreMap.Server.GameFeed;
using ScoreMap.Server.Tests.Support;
using static ScoreMap.Server.GameFeed.ProviderPeriodPhase;
using static ScoreMap.Server.GameFeed.ProviderStatus;

namespace ScoreMap.Server.Tests;

/// <summary>The short clock line a connected client receives for each game, read the way each sport reads it.</summary>
public class ClockLineTests
{
    private const string Nfl = "football/nfl";

    [Theory]
    [InlineData(InProgress, "4:12", 3, Playing, "Q3 4:12")]
    [InlineData(InProgress, "0:00", 1, Break, "End Q1")]
    [InlineData(InProgress, "0:00", 2, Break, "Halftime")]
    [InlineData(InProgress, "7:30", 5, Playing, "OT 7:30")]
    [InlineData(Delayed, "2:00", 4, Playing, "Q4 2:00")]
    [InlineData(Final, "0:00", 4, Playing, "Final")]
    [InlineData(Final, "0:00", 5, Playing, "Final/OT")]
    public async Task American_football(ProviderStatus status, string clock, int period, ProviderPeriodPhase phase, string expected) =>
        Assert.Equal(expected, await ClockLineAsync(Nfl, status, clock, period, phase));

    [Theory]
    [InlineData(InProgress, "5:41", 4, Playing, "Q4 5:41")]
    [InlineData(InProgress, "0.0", 2, Break, "Halftime")]
    [InlineData(InProgress, "1:02", 6, Playing, "2OT 1:02")]
    [InlineData(Final, "0.0", 4, Playing, "Final")]
    public async Task Basketball_in_quarters(ProviderStatus status, string clock, int period, ProviderPeriodPhase phase, string expected) =>
        Assert.Equal(expected, await ClockLineAsync("basketball/nba", status, clock, period, phase));

    [Theory]
    [InlineData(InProgress, "12:34", 2, Playing, "H2 12:34")]
    [InlineData(InProgress, "0:00", 1, Break, "Halftime")]
    [InlineData(InProgress, "3:00", 3, Playing, "OT 3:00")]
    [InlineData(Final, "0:00", 3, Playing, "Final/OT")]
    public async Task Basketball_in_halves(ProviderStatus status, string clock, int period, ProviderPeriodPhase phase, string expected) =>
        Assert.Equal(expected, await ClockLineAsync("basketball/mens-college-basketball?groups=50", status, clock, period, phase));

    [Theory]
    [InlineData(InProgress, "6:35", 3, Playing, "P3 6:35")]
    [InlineData(InProgress, "0:00", 2, Break, "End P2")]
    [InlineData(InProgress, "2:10", 4, Playing, "OT 2:10")]
    [InlineData(InProgress, "0:00", 5, Shootout, "SO")]
    [InlineData(Final, "0:00", 3, Playing, "Final")]
    [InlineData(Final, "0:00", 4, Playing, "Final/OT")]
    public async Task Hockey(ProviderStatus status, string clock, int period, ProviderPeriodPhase phase, string expected) =>
        Assert.Equal(expected, await ClockLineAsync("hockey/nhl", status, clock, period, phase));

    [Theory]
    [InlineData(InProgress, 7, InningTop, "Top 7th")]
    [InlineData(InProgress, 7, InningMiddle, "Mid 7th")]
    [InlineData(InProgress, 1, InningBottom, "Bot 1st")]
    [InlineData(InProgress, 2, InningEnd, "End 2nd")]
    [InlineData(InProgress, 3, InningTop, "Top 3rd")]
    [InlineData(InProgress, 11, InningBottom, "Bot 11th")]
    [InlineData(InProgress, 12, InningTop, "Top 12th")]
    [InlineData(InProgress, 21, InningTop, "Top 21st")]
    [InlineData(Final, 9, Playing, "Final")]
    [InlineData(Final, 10, Playing, "Final/10")]
    public async Task Baseball(ProviderStatus status, int inning, ProviderPeriodPhase phase, string expected) =>
        Assert.Equal(expected, await ClockLineAsync("baseball/mlb", status, "0:00", inning, phase));

    [Theory]
    [InlineData(InProgress, "67'", 2, Playing, "67'")]
    [InlineData(InProgress, "45'+2'", 1, Playing, "45'+2'")]
    [InlineData(InProgress, "45'", 1, Break, "HT")]
    [InlineData(InProgress, "105'", 3, Break, "ET HT")]
    [InlineData(InProgress, "120'", 5, Shootout, "Pens")]
    [InlineData(Final, "90'+5'", 2, Playing, "FT")]
    [InlineData(Final, "120'+5'", 4, Playing, "AET")]
    public async Task Soccer(ProviderStatus status, string clock, int period, ProviderPeriodPhase phase, string expected) =>
        Assert.Equal(expected, await ClockLineAsync("soccer/eng.1", status, clock, period, phase));

    [Fact]
    public async Task Game_that_has_not_started_has_no_clock_line() =>
        Assert.Null(await ClockLineAsync(Nfl, Scheduled, null, null, Playing));

    private static async Task<string?> ClockLineAsync(
        string leagueKey, ProviderStatus status, string? clock, int? period, ProviderPeriodPhase phase)
    {
        await using var server = new ScoreMapServer();
        server.Feed.SetScoreboard(leagueKey, new ProviderGame(
            Id: "1",
            LeagueKey: leagueKey,
            StartTime: server.Clock.GetUtcNow().AddHours(-1),
            Home: new ProviderTeam("HOM", "Home Team", null, status == Scheduled ? null : 1),
            Away: new ProviderTeam("AWY", "Away Team", null, status == Scheduled ? null : 0),
            Status: status,
            DisplayClock: clock,
            Period: period,
            Venue: new ProviderVenue("Stadium", "City", null, "Country", new Coordinates(10, 20)),
            Broadcasters: [],
            Phase: phase));

        await using var client = await server.ConnectClientAsync();
        return Assert.Single(await client.NextSnapshotAsync()).Clock;
    }
}
