namespace ScoreMap.Server.GameFeed;

/// <summary>
/// Walking-skeleton provider: a few fixed NFL games with venue coordinates,
/// timed relative to the clock. Replaced by the ESPN adapter in a later ticket.
/// </summary>
public sealed class HardCodedGameFeedProvider(TimeProvider clock) : IGameFeedProvider
{
    private const string Nfl = "football/nfl";

    public Task<IReadOnlyList<ProviderGame>> FetchScoreboardAsync(string leagueKey, CancellationToken cancellationToken)
    {
        if (leagueKey != Nfl)
            return Task.FromResult<IReadOnlyList<ProviderGame>>([]);

        var now = clock.GetUtcNow();
        IReadOnlyList<ProviderGame> games =
        [
            Game("demo-1", now.AddHours(-1), ProviderStatus.InProgress, "4:12", 3,
                Team("KC", "Kansas City Chiefs", 21), Team("BUF", "Buffalo Bills", 17),
                new ProviderVenue("GEHA Field at Arrowhead Stadium", "Kansas City", "MO", "USA", new Coordinates(39.0489, -94.4839))),
            Game("demo-2", now.AddHours(-2), ProviderStatus.InProgress, "2:05", 4,
                Team("JAX", "Jacksonville Jaguars", 13), Team("CHI", "Chicago Bears", 20),
                new ProviderVenue("Tottenham Hotspur Stadium", "London", null, "England", new Coordinates(51.6043, -0.0664))),
            Game("demo-3", now.AddHours(2), ProviderStatus.Scheduled, null, null,
                Team("GB", "Green Bay Packers", null), Team("DET", "Detroit Lions", null),
                new ProviderVenue("Lambeau Field", "Green Bay", "WI", "USA", new Coordinates(44.5013, -88.0622))),
            Game("demo-4", now.AddHours(-4), ProviderStatus.Final, "0:00", 4,
                Team("LAR", "Los Angeles Rams", 27), Team("SF", "San Francisco 49ers", 24),
                new ProviderVenue("SoFi Stadium", "Inglewood", "CA", "USA", new Coordinates(33.9535, -118.3392))),
        ];
        return Task.FromResult(games);
    }

    private static ProviderGame Game(string id, DateTimeOffset start, ProviderStatus status, string? clock, int? period,
        ProviderTeam home, ProviderTeam away, ProviderVenue venue) =>
        new(id, Nfl, start, home, away, status, clock, period, venue, [new ProviderBroadcaster("CBS", "USA")]);

    private static ProviderTeam Team(string abbreviation, string name, int? score) =>
        new(abbreviation, name, $"https://a.espncdn.com/i/teamlogos/nfl/500/{abbreviation.ToLowerInvariant()}.png", score);
}
