using ScoreMap.Server.GameFeed;
using ScoreMap.Server.Games;
using ScoreMap.Server.Tests.Support;
using static ScoreMap.Server.GameFeed.ProviderStatus;

namespace ScoreMap.Server.Tests;

/// <summary>A tennis match as a connected client receives it: its score, progress line, scoreline and venue.</summary>
public class TennisTests
{
    private const string Atp = "tennis/atp";

    private static readonly ProviderVenue Shanghai = new("Rolex Shanghai Masters", "Shanghai, China PR", null, null, Court: "Stadium Court");

    /// <summary>A match between J. Sinner (home) and C. Alcaraz (away), each with the sets they won.</summary>
    private static ProviderGame Match(ScoreMapServer server, ProviderStatus status, int? period, IReadOnlyList<ProviderSet> sets,
        ProviderEarlyEnding? earlyEnding = null, string id = "184958") => new(
        Id: id,
        LeagueKey: Atp,
        StartTime: server.Clock.GetUtcNow().AddHours(-1),
        Home: new ProviderTeam("J. Sinner", "Jannik Sinner", "https://a.espncdn.com/i/teamlogos/countries/500/ita.png",
            status == Scheduled ? null : sets.Count(s => s.HomeWon == true)),
        Away: new ProviderTeam("C. Alcaraz", "Carlos Alcaraz", "https://a.espncdn.com/i/teamlogos/countries/500/esp.png",
            status == Scheduled ? null : sets.Count(s => s.HomeWon == false)),
        Status: status,
        DisplayClock: null,
        Period: period,
        Venue: Shanghai,
        Broadcasters: [])
    {
        Note = "Rolex Shanghai Masters · QF",
        Sets = sets,
        EarlyEnding = earlyEnding,
    };

    /// <summary>
    /// A scoreline's parts, each set written "1st 7-6(5) J. Sinner" (its winner left off while it's
    /// played) and the sets joined by " | ", so they compare by value.
    /// </summary>
    private static (string Sets, string? Ending, string? Advanced) Parts(GameScoreline? scoreline) =>
        scoreline is null
            ? throw new Xunit.Sdk.XunitException("No scoreline")
            : (string.Join(" | ", scoreline.Sets.Select(set => $"{set.Name} {set.Score} {set.Winner}".TrimEnd())), scoreline.Ending, scoreline.Advanced);

    private static async Task<Game> ReceivedAsync(ScoreMapServer server, ProviderGame match)
    {
        server.Feed.SetScoreboard(Atp, match);
        await using var client = await server.ConnectClientAsync();
        return Assert.Single(await client.NextSnapshotAsync());
    }

    [Fact]
    public async Task A_live_match_scores_sets_won_and_its_progress_line_shows_the_current_set_and_its_games()
    {
        await using var server = new ScoreMapServer();

        var game = await ReceivedAsync(server, Match(server, InProgress, 2,
            [new ProviderSet(7, 6, HomeTiebreak: 7, AwayTiebreak: 5, HomeWon: true), new ProviderSet(4, 3)]));

        Assert.Equal(("ATP", "Tennis", GameStatus.Live), (game.League, game.Sport, game.Status));
        // The home side is shown on top, so its games come first.
        Assert.Equal(("1", "0"), (game.Home.Score, game.Away.Score));
        Assert.Equal("2nd set · 4–3", game.Clock);
        // Each finished set names its winner, its games first; the set in play reads top side first, as the progress line does.
        Assert.Equal(("1st 7-6(5) J. Sinner | 2nd 4-3", null, null), Parts(game.Scoreline));
        Assert.False(game.Hot);
    }

    [Fact]
    public async Task A_live_match_between_sets_shows_just_the_set_to_come()
    {
        await using var server = new ScoreMapServer();

        var game = await ReceivedAsync(server, Match(server, InProgress, 2, [new ProviderSet(6, 4, HomeWon: true)]));

        Assert.Equal("2nd set", game.Clock);
    }

    [Fact]
    public async Task A_finished_match_is_Final_with_its_whole_scoreline()
    {
        await using var server = new ScoreMapServer();

        var game = await ReceivedAsync(server, Match(server, Final, 2, [new ProviderSet(4, 6, HomeWon: false), new ProviderSet(6, 7, 3, 7, HomeWon: false)]));

        Assert.Equal((GameStatus.Final, "Final"), (game.Status, game.Clock));
        Assert.Equal(("1st 6-4 C. Alcaraz | 2nd 7-6(3) C. Alcaraz", null, null), Parts(game.Scoreline));
    }

    [Fact]
    public async Task A_retirement_is_Final_with_Ret_and_names_the_side_that_advances()
    {
        await using var server = new ScoreMapServer();

        var game = await ReceivedAsync(server, Match(server, Final, 2, [new ProviderSet(7, 5, HomeWon: true), new ProviderSet(0, 1)],
            new ProviderEarlyEnding(EarlyEndingReason.Retired, "J. Sinner")));

        Assert.Equal((GameStatus.Final, "Ret."), (game.Status, game.Clock));
        Assert.Equal(("1st 7-5 J. Sinner | 2nd 0-1", "ret.", "J. Sinner"), Parts(game.Scoreline));
    }

    [Fact]
    public async Task A_walkover_is_Final_with_W_O_and_names_the_side_that_advances()
    {
        await using var server = new ScoreMapServer();

        var game = await ReceivedAsync(server, Match(server, Final, 1, [],
            new ProviderEarlyEnding(EarlyEndingReason.Walkover, "J. Sinner")));

        Assert.Equal((GameStatus.Final, "W/O"), (game.Status, game.Clock));
        Assert.Equal(("", "W/O", "J. Sinner"), Parts(game.Scoreline));
    }

    [Fact]
    public async Task A_suspended_match_is_Disrupted()
    {
        await using var server = new ScoreMapServer();

        var game = await ReceivedAsync(server, Match(server, Suspended, 2, [new ProviderSet(6, 4, HomeWon: true), new ProviderSet(2, 2)]));

        Assert.Equal((GameStatus.Disrupted, Disruption.Suspended), (game.Status, game.Disruption));
    }

    [Fact]
    public async Task A_match_yet_to_start_has_no_scoreline_and_other_sports_have_none()
    {
        await using var server = new ScoreMapServer();
        server.Feed.SetScoreboard(Atp, Match(server, Scheduled, null, []) with { StartTime = server.Clock.GetUtcNow().AddHours(1) });
        server.Feed.SetScoreboard(TestGames.Nfl, TestGames.LiveGame(server.Clock, "401", 7, 3));

        await using var client = await server.ConnectClientAsync();
        var games = await client.NextSnapshotAsync();

        Assert.All(games, game => Assert.Null(game.Scoreline));
    }

    [Fact]
    public async Task The_game_carries_its_court_and_its_tournament_and_round()
    {
        await using var server = new ScoreMapServer();

        var game = await ReceivedAsync(server, Match(server, InProgress, 1, [new ProviderSet(1, 0)]));

        Assert.Equal(("Rolex Shanghai Masters", "Shanghai, China PR", "Stadium Court"), (game.Venue.Name, game.Venue.City, game.Venue.Court));
        Assert.Equal("Rolex Shanghai Masters · QF", game.Note);
    }

    [Fact]
    public async Task A_match_is_pinned_at_its_tournament_looked_up_in_its_city()
    {
        await using var server = new ScoreMapServer();
        server.Places.Add("Rolex Shanghai Masters, Shanghai, China PR", new Coordinates(31.04, 121.36));
        server.Places.Add("Shanghai, China PR", new Coordinates(31.23, 121.47));

        var game = await ReceivedAsync(server, Match(server, InProgress, 1, [new ProviderSet(1, 0)]));

        Assert.Equal((31.04, 121.36), (game.Venue.Latitude, game.Venue.Longitude));
    }

    [Fact]
    public async Task A_match_whose_tournament_is_not_found_is_pinned_at_its_city_centre()
    {
        await using var server = new ScoreMapServer();
        server.Places.Add("Shanghai, China PR", new Coordinates(31.23, 121.47));

        var game = await ReceivedAsync(server, Match(server, InProgress, 1, [new ProviderSet(1, 0)]));

        Assert.Equal((31.23, 121.47), (game.Venue.Latitude, game.Venue.Longitude));
    }

    [Fact]
    public async Task A_venue_correction_keyed_by_the_tournament_moves_its_matches_pin()
    {
        await using var server = new ScoreMapServer();
        server.Places.Add("Rolex Shanghai Masters, Shanghai, China PR", new Coordinates(31.04, 121.36));
        server.CorrectVenue("Rolex Shanghai Masters", new Coordinates(31.05, 121.37));

        var game = await ReceivedAsync(server, Match(server, InProgress, 1, [new ProviderSet(1, 0)]));

        Assert.Equal((31.05, 121.37), (game.Venue.Latitude, game.Venue.Longitude));
    }

    [Fact]
    public async Task A_match_ESPN_lists_in_its_Top_Events_by_competition_id_comes_marked()
    {
        await using var server = new ScoreMapServer();
        // ESPN lists a top tennis match by its tournament's id and the match's competition id, the game's id.
        server.Feed.SetTopEvents("315-2026", "184958");
        server.Feed.SetScoreboard(Atp,
            Match(server, InProgress, 1, [new ProviderSet(1, 0)]),
            Match(server, InProgress, 1, [new ProviderSet(0, 1)], id: "184955"),
            Match(server, InProgress, 1, [new ProviderSet(0, 1)], id: "184999"));

        await using var client = await server.ConnectClientAsync();
        var games = await client.NextSnapshotAsync();

        Assert.Equal(["184958"], games.Where(g => g.TopEvent).Select(g => g.Id));
    }
}
