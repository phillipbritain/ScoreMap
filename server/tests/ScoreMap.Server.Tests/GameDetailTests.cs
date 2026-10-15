using ScoreMap.Server.GameFeed;
using ScoreMap.Server.Games;
using ScoreMap.Server.Tests.Support;
using static ScoreMap.Server.GameFeed.ProviderPeriodPhase;
using static ScoreMap.Server.Tests.Support.TestGames;

namespace ScoreMap.Server.Tests;

/// <summary>The extra detail for the game panel a connected client receives with each game.</summary>
public class GameDetailTests
{
    private static async Task<Game> SnapshotOfAsync(ProviderGame game)
    {
        await using var server = new ScoreMapServer();
        server.Feed.SetScoreboard(game.LeagueKey, game with { StartTime = server.Clock.GetUtcNow().AddHours(-1) });
        await using var client = await server.ConnectClientAsync();
        return Assert.Single(await client.NextSnapshotAsync());
    }

    private static ProviderGame Live(string leagueKey) =>
        Game("1", leagueKey, DateTimeOffset.MinValue, ProviderStatus.InProgress, 1, 0, "4:12", 3);

    [Fact]
    public async Task Teams_carry_their_rank_and_record_and_the_game_its_note_attendance_and_betting_line()
    {
        var game = Live(Nfl) with
        {
            Note = "AFC Wild Card Playoffs",
            Attendance = 60670,
            Odds = new ProviderOdds("KC -3.5", 47.5, "DraftKings"),
        };
        game = game with
        {
            Home = game.Home with { Rank = 17, Record = "5-2" },
            Away = game.Away with { Record = "6-0" },
        };

        var sent = await SnapshotOfAsync(game);

        Assert.Equal((17, "5-2"), (sent.Home.Rank, sent.Home.Record));
        Assert.Equal((null, "6-0"), (sent.Away.Rank, sent.Away.Record));
        Assert.Equal("AFC Wild Card Playoffs", sent.Note);
        Assert.Equal(60670, sent.Attendance);
        Assert.Equal(new GameOdds("KC -3.5", 47.5, "DraftKings"), sent.Odds);
    }

    [Theory]
    [InlineData(Nfl, 4, "5:58", Playing, "Q4 5:58")]
    [InlineData(Nfl, 5, "2:10", Playing, "OT 2:10")]
    [InlineData("basketball/mens-college-basketball?groups=50", 2, "0:45", Playing, "H2 0:45")]
    [InlineData("hockey/nhl", 3, "13:31", Playing, "P3 13:31")]
    [InlineData("baseball/mlb", 7, null, InningTop, "Top 7th")]
    [InlineData("baseball/mlb", 10, null, InningBottom, "Bot 10th")]
    [InlineData("soccer/eng.1", null, "90'+5'", Playing, "90'+5'")]
    public async Task Last_score_says_when_it_came_as_the_clock_line_would(
        string leagueKey, int? period, string? clock, ProviderPeriodPhase phase, string when)
    {
        var game = Live(leagueKey) with { LastScore = new ProviderScoringPlay("KC", "Something scored", period, clock, phase) };

        var sent = await SnapshotOfAsync(game);

        Assert.Equal(new ScoringPlay("KC", "Something scored", when), sent.LastScore);
    }

    [Fact]
    public async Task Situation_is_sent_while_the_game_is_live()
    {
        var situation = new ProviderSituation("Mahomes pass short right to Kelce for 8 yards", "2nd & 2 at BUF 34", "KC");

        var sent = await SnapshotOfAsync(Live(Nfl) with { Situation = situation });

        Assert.Equal(new GameSituation("Mahomes pass short right to Kelce for 8 yards", "2nd & 2 at BUF 34", "KC",
            null, null, null, false, false, false), sent.Situation);
    }

    [Fact]
    public async Task Situation_is_not_sent_once_the_game_is_over()
    {
        var game = Live(Nfl) with { Status = ProviderStatus.Final, Situation = new ProviderSituation("End of game") };

        Assert.Null((await SnapshotOfAsync(game)).Situation);
    }

    [Fact]
    public async Task Soccer_goals_and_cards_are_sent_in_order()
    {
        var game = Live("soccer/eng.1") with
        {
            KeyEvents =
            [
                new ProviderKeyEvent(KeyEventKind.Goal, "KC", "Declan Rice", "38'"),
                new ProviderKeyEvent(KeyEventKind.YellowCard, "BUF", null, "58'"),
            ],
        };

        var sent = await SnapshotOfAsync(game);

        Assert.Equal([
            new KeyEvent(KeyEventKind.Goal, "KC", "Declan Rice", "38'"),
            new KeyEvent(KeyEventKind.YellowCard, "BUF", null, "58'"),
        ], sent.KeyEvents);
    }

    [Fact]
    public async Task A_new_card_is_pushed_as_an_update_and_the_same_cards_again_are_not()
    {
        await using var server = new ScoreMapServer();
        var game = LiveGame(server.Clock, "401", leagueKey: "soccer/eng.1") with
        {
            KeyEvents = [new ProviderKeyEvent(KeyEventKind.YellowCard, "BUF", "Josh Allen", "12'")],
        };
        server.Feed.SetScoreboard("soccer/eng.1", game);
        await using var client = await server.ConnectClientAsync();
        await client.NextSnapshotAsync();

        // The same cards, in a new list as every fetch makes, then a second card.
        server.Feed.SetScoreboard("soccer/eng.1", game with { KeyEvents = game.KeyEvents.ToList() });
        var fetched = server.Feed.Fetches("soccer/eng.1");
        server.Clock.Advance(TimeSpan.FromSeconds(15));
        await server.Feed.WaitForFetchesAsync("soccer/eng.1", fetched + 1);
        server.Feed.SetScoreboard("soccer/eng.1", game with
        {
            KeyEvents = [.. game.KeyEvents, new ProviderKeyEvent(KeyEventKind.RedCard, "KC", "Patrick Mahomes", "40'")],
        });
        server.Clock.Advance(TimeSpan.FromSeconds(15));

        var change = await client.NextChangeAsync();
        Assert.Equal(GameChangeKind.Updated, change.Kind);
        Assert.Equal(2, change.Game.KeyEvents.Count);
    }
}
