using ScoreMap.Server.GameFeed;

namespace ScoreMap.Server.Tests.Support;

/// <summary>Provider games for tests, timed relative to the test server's clock.</summary>
public static class TestGames
{
    public const string Nfl = "football/nfl";

    public static ProviderGame LiveGame(TimeProvider clock, string id, int homeScore = 0, int awayScore = 0, string leagueKey = Nfl) =>
        Game(id, leagueKey, clock.GetUtcNow().AddHours(-1), ProviderStatus.InProgress, homeScore, awayScore, "4:12", 3);

    public static ProviderGame UpcomingGame(TimeProvider clock, string id, string leagueKey = Nfl) =>
        Game(id, leagueKey, clock.GetUtcNow().AddHours(1), ProviderStatus.Scheduled, null, null, null, null);

    public static ProviderGame Game(string id, string leagueKey, DateTimeOffset startTime, ProviderStatus status,
        int? homeScore, int? awayScore, string? clock, int? period) => new(
        Id: id,
        LeagueKey: leagueKey,
        StartTime: startTime,
        Home: new ProviderTeam("KC", "Kansas City Chiefs", null, homeScore),
        Away: new ProviderTeam("BUF", "Buffalo Bills", null, awayScore),
        Status: status,
        DisplayClock: clock,
        Period: period,
        Venue: new ProviderVenue("GEHA Field at Arrowhead Stadium", "Kansas City", "MO", "USA"),
        Broadcasters: []);
}
