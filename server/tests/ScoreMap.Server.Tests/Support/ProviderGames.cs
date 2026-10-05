using ScoreMap.Server.GameFeed;

namespace ScoreMap.Server.Tests.Support;

/// <summary>Builds provider games for tests that care only about a few fields.</summary>
public static class ProviderGames
{
    public static ProviderGame NflGame(
        DateTimeOffset startTime,
        ProviderStatus status,
        string id = "401",
        string? clock = null,
        int? period = null) => new(
            Id: id,
            LeagueKey: "football/nfl",
            StartTime: startTime,
            Home: new ProviderTeam("KC", "Kansas City Chiefs", null, null),
            Away: new ProviderTeam("BUF", "Buffalo Bills", null, null),
            Status: status,
            DisplayClock: clock,
            Period: period,
            Venue: new ProviderVenue("GEHA Field at Arrowhead Stadium", "Kansas City", "MO", "USA",
                new Coordinates(39.0489, -94.4839)),
            Broadcasters: []);
}
