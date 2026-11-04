using ScoreMap.Server.Games;
using ScoreMap.Server.Tests.Support;
using static ScoreMap.Server.Tests.Support.TestGames;

namespace ScoreMap.Server.Tests;

public class ClientObservationTests
{
    [Fact]
    public async Task A_game_can_arrive_after_the_initial_snapshot()
    {
        await using var server = new ScoreMapServer();
        server.Feed.SetScoreboard(Nfl, LiveGame(server.Clock, "late"));
        server.Feed.HoldUntilReleased(Nfl);
        await using var client = await server.ConnectClientAsync();
        Assert.Empty(await client.NextSnapshotAsync());

        var ready = client.GamesMatchingAsync(games => games.Count == 1);
        Assert.False(ready.IsCompleted);
        server.Feed.Release(Nfl);
        var games = await ready;

        Assert.Equal("late", Assert.Single(games).Id);
    }
    [Fact]
    public async Task Venue_enrichment_can_arrive_after_basic_game_data()
    {
        await using var server = new ScoreMapServer();
        const string query = "Slow Stadium, London";
        server.Places.Add(query, new(51.6, -0.1));
        server.Places.Hold(query);
        server.Feed.SetScoreboard(Nfl, LiveGame(server.Clock, "game") with
        {
            Venue = new("Slow Stadium", "London", null, "England"),
        });
        await using var client = await server.ConnectClientAsync();
        var basic = await client.GameMatchingAsync(g => g.Id == "game");
        Assert.Equal((0d, 0d), (basic.Venue.Latitude, basic.Venue.Longitude));

        var enriched = client.GameMatchingAsync(g => g.Id == "game" && g.Venue.Latitude != 0);
        Assert.False(enriched.IsCompleted);
        server.Places.Release(query);

        var game = await enriched;
        Assert.Equal((51.6, -0.1), (game.Venue.Latitude, game.Venue.Longitude));
        Assert.Equal(basic.Sides(), game.Sides());
    }
    [Fact]
    public async Task Observations_keep_games_with_the_same_id_in_different_leagues_and_apply_removals()
    {
        await using var server = new ScoreMapServer();
        const string nba = "basketball/nba";
        server.Feed.SetScoreboard(Nfl, LiveGame(server.Clock, "shared"));
        server.Feed.SetScoreboard(nba, LiveGame(server.Clock, "shared", leagueKey: nba));
        await using var client = await server.ConnectClientAsync();
        var both = await client.GamesMatchingAsync(games => games.Count == 2);
        var football = Assert.Single(both, g => g.Sport == "Football");

        server.Feed.SetScoreboard(Nfl);
        server.Clock.Advance(TimeSpan.FromSeconds(15));
        var remaining = await client.GamesMatchingAsync(games => games.Count == 1);

        Assert.Equal("Basketball", Assert.Single(remaining).Sport);
        Assert.Equal("shared", football.Id);
        Assert.Equal(2, both.Count);
    }
}
