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

    /// <summary>A match between J. Sinner (home) and C. Alcaraz (away), each with their sets won.</summary>
    private static ProviderGame Match(ScoreMapServer server, ProviderStatus status, int? period, IReadOnlyList<ProviderSet> sets,
        ProviderEarlyEnding? earlyEnding = null, string id = "184958") => new(
        Id: id,
        LeagueKey: Atp,
        StartTime: server.Clock.GetUtcNow().AddHours(-1),
        Home: new ProviderTeam("J. Sinner", "Jannik Sinner", "https://a.espncdn.com/i/teamlogos/countries/500/ita.png",
            status == Scheduled ? null : sets.Count(s => s.Home > s.Away && s.Home >= 6)),
        Away: new ProviderTeam("C. Alcaraz", "Carlos Alcaraz", "https://a.espncdn.com/i/teamlogos/countries/500/esp.png",
            status == Scheduled ? null : sets.Count(s => s.Away > s.Home && s.Away >= 6)),
        Status: status,
        DisplayClock: null,
        Period: period,
        Venue: Shanghai,
        Broadcasters: [])
    {
        Note = "Rolex Shanghai Masters · Quarterfinal",
        Sets = sets,
        EarlyEnding = earlyEnding,
    };

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
            [new ProviderSet(6, 7, HomeTiebreak: 5, AwayTiebreak: 7), new ProviderSet(3, 4)]));

        Assert.Equal(("ATP", "Tennis", GameStatus.Live), (game.League, game.Sport, game.Status));
        // The away side is shown first, so its games come first.
        Assert.Equal(("1", "0"), (game.Away.Score, game.Home.Score));
        Assert.Equal("2nd set · 4–3", game.Clock);
        Assert.Equal("7-6(5) 4-3", game.Scoreline);
        Assert.False(game.Hot);
    }

    [Fact]
    public async Task A_live_match_between_sets_shows_just_the_set_to_come()
    {
        await using var server = new ScoreMapServer();

        var game = await ReceivedAsync(server, Match(server, InProgress, 2, [new ProviderSet(6, 4)]));

        Assert.Equal("2nd set", game.Clock);
    }

    [Fact]
    public async Task A_finished_match_is_Final_with_its_whole_scoreline()
    {
        await using var server = new ScoreMapServer();

        var game = await ReceivedAsync(server, Match(server, Final, 2, [new ProviderSet(6, 4), new ProviderSet(7, 6, 7, 3)]));

        Assert.Equal((GameStatus.Final, "Final"), (game.Status, game.Clock));
        Assert.Equal("4-6 6-7(3)", game.Scoreline);
    }

    [Fact]
    public async Task A_retirement_is_Final_with_Ret_and_names_the_side_that_advances()
    {
        await using var server = new ScoreMapServer();

        var game = await ReceivedAsync(server, Match(server, Final, 2, [new ProviderSet(5, 7), new ProviderSet(1, 0)],
            new ProviderEarlyEnding(EarlyEndingReason.Retired, "C. Alcaraz")));

        Assert.Equal((GameStatus.Final, "Ret."), (game.Status, game.Clock));
        Assert.Equal("7-5 0-1 ret. · C. Alcaraz advances", game.Scoreline);
    }

    [Fact]
    public async Task A_walkover_is_Final_with_W_O_and_names_the_side_that_advances()
    {
        await using var server = new ScoreMapServer();

        var game = await ReceivedAsync(server, Match(server, Final, 1, [],
            new ProviderEarlyEnding(EarlyEndingReason.Walkover, "J. Sinner")));

        Assert.Equal((GameStatus.Final, "W/O"), (game.Status, game.Clock));
        Assert.Equal("W/O · J. Sinner advances", game.Scoreline);
    }

    [Fact]
    public async Task A_suspended_match_is_Disrupted()
    {
        await using var server = new ScoreMapServer();

        var game = await ReceivedAsync(server, Match(server, Suspended, 2, [new ProviderSet(6, 4), new ProviderSet(2, 2)]));

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
        Assert.Equal("Rolex Shanghai Masters · Quarterfinal", game.Note);
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
