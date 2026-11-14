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
            ("baseball/college-softball", "NCAA Softball", "Baseball"),
            ("hockey/mens-college-hockey", "NCAA Men's Hockey", "Hockey"),
            ("hockey/nhl", "NHL", "Hockey"),
            ("soccer/usa.1", "MLS", "Soccer"),
            ("soccer/eng.1", "Premier League", "Soccer"),
            ("soccer/uefa.champions", "Champions League", "Soccer"),
            ("soccer/fifa.world", "World Cup", "Soccer"),
            ("cricket/8048", "IPL", "Cricket"),
            ("rugby/180659", "Six Nations", "Rugby"),
            ("tennis/atp", "ATP", "Tennis"),
            ("tennis/wta", "WTA", "Tennis"),
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

        var leagues = await http.GetFromJsonAsync<LeagueListing[]>("/api/leagues", TestContext.Current.CancellationToken);

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
            new LeagueListing("NCAA Softball", "Baseball"),
            new LeagueListing("NCAA Men's Hockey", "Hockey"),
            new LeagueListing("NHL", "Hockey"),
            new LeagueListing("MLS", "Soccer"),
            new LeagueListing("Premier League", "Soccer"),
            new LeagueListing("Champions League", "Soccer"),
            new LeagueListing("World Cup", "Soccer"),
            new LeagueListing("IPL", "Cricket"),
            new LeagueListing("Six Nations", "Rugby"),
            new LeagueListing("ATP", "Tennis"),
            new LeagueListing("WTA", "Tennis"),
            new LeagueListing("NASCAR Cup Series", "Racing"),
            new LeagueListing("Formula 1", "Racing"),
            new LeagueListing("IndyCar Series", "Racing"),
            new LeagueListing("PGA Tour", "Golf"),
            new LeagueListing("LPGA Tour", "Golf"),
            new LeagueListing("UFC", "MMA"),
        ], leagues);
    }

    [Fact]
    public async Task The_browser_can_list_each_college_leagues_conferences_by_name()
    {
        await using var server = new ScoreMapServer();
        using var http = server.CreateClient();

        var leagues = await http.GetFromJsonAsync<ConferenceListing[]>("/api/leagues", TestContext.Current.CancellationToken);

        var football = Assert.Single(leagues!, league => league.Name == "NCAA Football").Conferences;
        Assert.Contains("SEC", football);
        Assert.Contains("ACC", football);
        Assert.Equal(football.Order(StringComparer.Ordinal), football);
        Assert.Contains("Big East", Assert.Single(leagues!, league => league.Name == "NCAA Women's Basketball").Conferences);
        Assert.Empty(Assert.Single(leagues!, league => league.Name == "NFL").Conferences);
    }

    [Fact]
    public async Task A_college_game_reaches_the_browser_with_each_teams_conference_by_name()
    {
        // ESPN's SEC is 8 in football and 23 in basketball; a team in no configured conference has none.
        await using var server = new ScoreMapServer();
        server.Feed.SetScoreboard("football/college-football", LiveGame(server, "cfb", "football/college-football", "8", "999"));
        server.Feed.SetScoreboard("basketball/mens-college-basketball?groups=50",
            LiveGame(server, "mbb", "basketball/mens-college-basketball?groups=50", "23", null));

        await using var client = await server.ConnectClientAsync();
        var snapshot = await client.NextSnapshotAsync();

        var football = Assert.Single(snapshot, g => g.Id == "cfb").Sides();
        Assert.Equal(("SEC", null), (football.Home.Conference, football.Away.Conference));
        var basketball = Assert.Single(snapshot, g => g.Id == "mbb").Sides();
        Assert.Equal(("SEC", null), (basketball.Home.Conference, basketball.Away.Conference));
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

    private sealed record ConferenceListing(string Name, string[] Conferences);

    private static ProviderGame LiveGame(ScoreMapServer server, string id, string leagueKey,
        string? homeConferenceId = null, string? awayConferenceId = null) => new(
        Id: id,
        LeagueKey: leagueKey,
        StartTime: server.Clock.GetUtcNow().AddMinutes(-30),
        Contest: new ProviderSides(
            new ProviderTeam("HOM", "Home Team", null, 1, ConferenceId: homeConferenceId),
            new ProviderTeam("AWY", "Away Team", null, 0, ConferenceId: awayConferenceId)),
        Status: ProviderStatus.InProgress,
        DisplayClock: "10:00",
        Period: 1,
        Venue: new ProviderVenue("Stadium", "City", null, "Country"));
}
