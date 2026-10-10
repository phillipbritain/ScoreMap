using System.Net.Http.Json;
using ScoreMap.Server.GameFeed;
using ScoreMap.Server.Tests.Support;

namespace ScoreMap.Server.Tests;

public class LeagueTests
{
    [Fact]
    public async Task Games_from_every_configured_league_reach_the_browser_with_their_league_and_sport()
    {
        (string Key, string League, string Sport)[] leagues =
        [
            ("football/nfl", "NFL", "Football"),
            ("football/college-football", "NCAA Football", "Football"),
            ("basketball/nba", "NBA", "Basketball"),
            ("basketball/mens-college-basketball?groups=50", "NCAA Men's Basketball", "Basketball"),
            ("basketball/wnba", "WNBA", "Basketball"),
            ("basketball/womens-college-basketball?groups=50", "NCAA Women's Basketball", "Basketball"),
            ("baseball/mlb", "MLB", "Baseball"),
            ("baseball/college-baseball", "NCAA Baseball", "Baseball"),
            ("hockey/nhl", "NHL", "Hockey"),
            ("soccer/usa.1", "MLS", "Soccer"),
            ("soccer/eng.1", "Premier League", "Soccer"),
            ("soccer/uefa.champions", "Champions League", "Soccer"),
            ("soccer/fifa.world", "World Cup", "Soccer"),
        ];
        await using var server = new ScoreMapServer();
        foreach (var (key, _, _) in leagues)
            server.Feed.SetScoreboard(key, LiveGame(server, id: key, key));

        await using var client = await server.ConnectClientAsync();
        var snapshot = await client.NextSnapshotAsync();

        Assert.Equal(
            leagues.Select(l => (l.Key, l.League, l.Sport)).OrderBy(l => l.Key),
            snapshot.Select(g => (g.Id, g.League, g.Sport)).OrderBy(g => g.Id));
    }

    [Fact]
    public async Task The_browser_can_list_every_configured_league_with_its_sport_in_order()
    {
        await using var server = new ScoreMapServer();
        using var http = server.CreateClient();

        var leagues = await http.GetFromJsonAsync<LeagueListing[]>("/api/leagues");

        Assert.NotNull(leagues);
        Assert.Equal(
        [
            new LeagueListing("NFL", "Football"),
            new LeagueListing("NCAA Football", "Football"),
            new LeagueListing("NBA", "Basketball"),
            new LeagueListing("NCAA Men's Basketball", "Basketball"),
            new LeagueListing("WNBA", "Basketball"),
            new LeagueListing("NCAA Women's Basketball", "Basketball"),
            new LeagueListing("MLB", "Baseball"),
            new LeagueListing("NCAA Baseball", "Baseball"),
            new LeagueListing("NHL", "Hockey"),
            new LeagueListing("MLS", "Soccer"),
            new LeagueListing("Premier League", "Soccer"),
            new LeagueListing("Champions League", "Soccer"),
            new LeagueListing("World Cup", "Soccer"),
        ], leagues);
    }

    [Fact]
    public async Task A_league_configured_with_an_unknown_sport_stops_the_server_from_starting()
    {
        await using var server = new ScoreMapServer();
        server.AddLeague("test/league", "Test League", "Americn football");

        var error = Record.Exception(() => server.CreateClient());

        Assert.NotNull(error);
        Assert.Contains("Americn football", error.ToString());
    }

    private sealed record LeagueListing(string Name, string Sport);

    private static ProviderGame LiveGame(ScoreMapServer server, string id, string leagueKey) => new(
        Id: id,
        LeagueKey: leagueKey,
        StartTime: server.Clock.GetUtcNow().AddMinutes(-30),
        Home: new ProviderTeam("HOM", "Home Team", null, 1),
        Away: new ProviderTeam("AWY", "Away Team", null, 0),
        Status: ProviderStatus.InProgress,
        DisplayClock: "10:00",
        Period: 1,
        Venue: new ProviderVenue("Stadium", "City", null, "Country"),
        Broadcasters: []);
}
