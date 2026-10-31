using System.Text.RegularExpressions;
using ScoreMap.Server.GameFeed;
using ScoreMap.Server.Games;
using ScoreMap.Server.Scenarios;

namespace ScoreMap.Server.Tests.Scenarios;

/// <summary>Making up a game at a venue in a given status, as fill (and random play) do.</summary>
public sealed class ScenarioGameMakerTests
{
    private static readonly League[] Leagues =
    [
        new() { Key = "football/nfl", Name = "NFL", Sport = Sport.Football, PlannedLength = TimeSpan.FromMinutes(195) },
        new() { Key = "basketball/nba", Name = "NBA", Sport = Sport.Basketball, PlannedLength = TimeSpan.FromMinutes(150) },
        new() { Key = "basketball/ncaa", Name = "NCAA Men's Basketball", Sport = Sport.Basketball, RegulationPeriods = 2, PeriodMinutes = 20, PlannedLength = TimeSpan.FromHours(2) },
        new() { Key = "basketball/wnba", Name = "WNBA", Sport = Sport.Basketball, PeriodMinutes = 10, PlannedLength = TimeSpan.FromHours(2) },
        new() { Key = "baseball/mlb", Name = "MLB", Sport = Sport.Baseball, PlannedLength = TimeSpan.FromHours(3) },
        new() { Key = "hockey/nhl", Name = "NHL", Sport = Sport.Hockey, PlannedLength = TimeSpan.FromMinutes(150) },
        new() { Key = "soccer/eng.1", Name = "Premier League", Sport = Sport.Soccer, PlannedLength = TimeSpan.FromHours(2) },
        new() { Key = "cricket/8048", Name = "IPL", Sport = Sport.Cricket, PlannedLength = TimeSpan.FromMinutes(210) },
    ];

    private static readonly ScenarioVenue At = new("Emirates Stadium", "London", null, "England", ["worldwide"]);

    // Six made-up teams in each league, named for it ("NFL team 1"), so a game's teams show where they came from.
    private static readonly ScenarioTeamList Teams = new(Leagues.ToDictionary(
        l => l.Name,
        l => (IReadOnlyList<ScenarioTeam>)Enumerable.Range(1, 6)
            .Select(n => new ScenarioTeam($"{l.Name} team {n}", $"T{n}", $"https://example.com/{l.Key}/{n}.png")).ToList()));

    // The most each team plausibly scores in a whole game.
    private static readonly Dictionary<Sport, int> MostPoints = new()
    {
        [Sport.Football] = 50,
        [Sport.Basketball] = 140,
        [Sport.Baseball] = 12,
        [Sport.Hockey] = 8,
        [Sport.Soccer] = 6,
        [Sport.Cricket] = 260,
    };

    public static TheoryData<string> LeagueKeys => new(Leagues.Select(l => l.Key));

    [Theory]
    [MemberData(nameof(LeagueKeys))]
    public void An_upcoming_game_starts_within_its_pin_window_with_no_score_or_clock(string leagueKey)
    {
        foreach (var (game, _) in Make(leagueKey, GameStatus.Upcoming))
        {
            Assert.Equal(ProviderStatus.Scheduled, game.Status);
            Assert.InRange(game.StartsIn, TimeSpan.FromMinutes(1), GameBoard.UpcomingWindow);
            Assert.Null(game.Sides.Home.Score);
            Assert.Null(game.Sides.Away.Score);
            Assert.Null(game.Clock);
            Assert.Null(game.Period);
        }
    }

    [Theory]
    [MemberData(nameof(LeagueKeys))]
    public void A_live_game_started_earlier_with_a_clock_period_and_score_to_match(string leagueKey)
    {
        foreach (var (game, league) in Make(leagueKey, GameStatus.Live))
        {
            Assert.Equal(ProviderStatus.InProgress, game.Status);
            Assert.InRange(game.StartsIn, -league.PlannedLength, -TimeSpan.FromMinutes(1));
            Assert.InRange(game.Sides.Away.Score!.Value, 0, MostPoints[league.Sport]);
            if (YetToBat(game.Sides.Home, game, league))
                Assert.Null(game.Sides.Home.Score);
            else
                Assert.InRange(game.Sides.Home.Score!.Value, 0, MostPoints[league.Sport]);
            AssertClockFits(game, league);
        }
    }

    [Fact]
    public void A_soccer_game_early_in_its_planned_length_is_in_the_first_half_and_one_late_in_it_in_the_second()
    {
        var soccer = Leagues.Single(l => l.Sport == Sport.Soccer);
        var games = Make(soccer.Key, GameStatus.Live).Select(made => made.Game).ToList();

        // Two 45-minute halves and halftime are spread across the planned 2 hours.
        Assert.All(games.Where(g => -g.StartsIn <= TimeSpan.FromMinutes(45)), game =>
            Assert.Equal((1, ProviderPeriodPhase.Playing), (game.Period, game.Phase)));
        Assert.All(games.Where(g => -g.StartsIn > TimeSpan.FromMinutes(75)), game =>
            Assert.Equal((2, ProviderPeriodPhase.Playing), (game.Period, game.Phase)));
        Assert.Contains(games, game => -game.StartsIn <= TimeSpan.FromMinutes(45));
        Assert.Contains(games, game => -game.StartsIn > TimeSpan.FromMinutes(75));
    }

    [Theory]
    [MemberData(nameof(LeagueKeys))]
    public void A_final_game_started_a_whole_game_ago_and_is_still_inside_its_pin_window(string leagueKey)
    {
        foreach (var (game, league) in Make(leagueKey, GameStatus.Final))
        {
            Assert.Equal(ProviderStatus.Final, game.Status);
            // The board takes a game first seen Final to have ended at its planned end, and shows it for 2 h after.
            Assert.InRange(game.StartsIn, -(league.PlannedLength + GameBoard.FinalWindow) + TimeSpan.FromMinutes(30), -league.PlannedLength);
            Assert.InRange(game.Sides.Away.Score!.Value, 0, MostPoints[league.Sport]);
            if (YetToBat(game.Sides.Home, game, league))
                Assert.Null(game.Sides.Home.Score);
            else
                Assert.InRange(game.Sides.Home.Score!.Value, 0, MostPoints[league.Sport]);
            Assert.Equal(league.Regulation, game.Period);
        }
    }

    [Theory]
    [MemberData(nameof(LeagueKeys))]
    public void A_final_game_in_a_sport_without_draws_never_ends_level(string leagueKey)
    {
        var games = Make(leagueKey, GameStatus.Final).ToList();
        // A level game is a draw in soccer, and in cricket a tie, settled by a Super Over the score doesn't show.
        if (games[0].League.Sport is Sport.Soccer or Sport.Cricket)
            return;

        Assert.All(games, made => Assert.NotEqual(made.Game.Sides.Home.Score, made.Game.Sides.Away.Score));
    }

    [Theory]
    [MemberData(nameof(LeagueKeys))]
    public void A_disrupted_game_is_postponed_suspended_or_canceled_and_inside_its_pin_window(string leagueKey)
    {
        var games = Make(leagueKey, GameStatus.Disrupted).ToList();

        Assert.Equal(
            [ProviderStatus.Postponed, ProviderStatus.Suspended, ProviderStatus.Canceled],
            games.Select(made => made.Game.Status).Distinct().Order());
        foreach (var (game, league) in games)
        {
            if (game.Status == ProviderStatus.Suspended)
            {
                // Stopped part way through, with the score it had.
                Assert.InRange(game.StartsIn, -league.PlannedLength, -TimeSpan.FromMinutes(1));
                Assert.NotNull(game.Sides.Away.Score);
                Assert.Equal(YetToBat(game.Sides.Home, game, league), game.Sides.Home.Score is null);
                Assert.NotNull(game.Period);
            }
            else
            {
                // Shown from 3 h before the planned start until 2 h after the planned end.
                Assert.InRange(game.StartsIn, -(league.PlannedLength + GameBoard.FinalWindow) + TimeSpan.FromMinutes(30), GameBoard.UpcomingWindow);
                Assert.Null(game.Sides.Home.Score);
                Assert.Null(game.Sides.Away.Score);
            }
        }
    }

    [Fact]
    public void A_live_cricket_game_has_the_away_team_batting_first_then_the_home_team_chasing_short_of_its_target()
    {
        var games = Make("cricket/8048", GameStatus.Live).Select(made => made.Game).ToList();

        Assert.Contains(games, game => game.Period == 1);
        Assert.Contains(games, game => game.Period == 2);
        Assert.All(games.Where(game => game.Period == 1), game =>
        {
            Assert.Null(game.Sides.Home.Innings);
            Assert.Null(game.Sides.Away.Innings!.Target);
        });
        Assert.All(games.Where(game => game is { Period: 2, Phase: ProviderPeriodPhase.Playing }), game =>
        {
            // The away team's innings is over: its runs and wickets stay, its overs don't.
            Assert.Null(game.Sides.Away.Innings!.Overs);
            Assert.Equal(game.Sides.Away.Score + 1, game.Sides.Home.Innings!.Target);
            // Still under way: not yet at the target, nor all out.
            Assert.True(game.Sides.Home.Score < game.Sides.Home.Innings.Target, $"{game.Sides.Home.Score} chasing {game.Sides.Home.Innings.Target}");
            Assert.NotNull(game.Sides.Home.Innings.Wickets);
        });
    }

    [Fact]
    public void A_final_cricket_game_ends_with_the_chase_won_the_chasing_side_all_out_or_its_overs_bowled()
    {
        var games = Make("cricket/8048", GameStatus.Final).Select(made => made.Game).ToList();

        Assert.All(games, game =>
        {
            var chase = game.Sides.Home.Innings!;
            Assert.True(
                game.Sides.Home.Score >= chase.Target || chase.Wickets is null || chase.Overs == "20",
                $"{game.Sides.Home.Score}/{chase.Wickets} in {chase.Overs} overs chasing {chase.Target}");
            Assert.True(game.Sides.Home.Score <= chase.Target + 5, "a chase stops once it reaches its target, with a six at most");
            Assert.InRange(Overs(chase.Overs), 0, 20);
        });
        Assert.Contains(games, game => game.Sides.Home.Score >= game.Sides.Home.Innings!.Target);
        Assert.Contains(games, game => game.Sides.Home.Score < game.Sides.Home.Innings!.Target);
    }

    [Theory]
    [MemberData(nameof(LeagueKeys))]
    public void A_game_is_two_different_teams_from_its_leagues_team_list_at_the_venue_given(string leagueKey)
    {
        foreach (var (game, league) in Make(leagueKey, GameStatus.Live))
        {
            var teams = Teams.For(league);
            Assert.Contains(teams, t => (t.Abbreviation, t.Name, t.LogoUrl) == (game.Sides.Home.Abbreviation, game.Sides.Home.FullName, game.Sides.Home.LogoUrl));
            Assert.Contains(teams, t => (t.Abbreviation, t.Name, t.LogoUrl) == (game.Sides.Away.Abbreviation, game.Sides.Away.FullName, game.Sides.Away.LogoUrl));
            Assert.NotEqual(game.Sides.Home.FullName, game.Sides.Away.FullName);
            Assert.Equal(league.Key, game.LeagueKey);
            Assert.Equal(At.ToProviderVenue(), game.Venue);
            Assert.Equal("made", game.Id);
        }
    }

    private static void AssertClockFits(ScenarioGame game, League league)
    {
        Assert.InRange(game.Period!.Value, 1, league.Regulation);
        switch (league.Sport)
        {
            case Sport.Baseball:
                Assert.Null(game.Clock);
                Assert.Contains(game.Phase, new[]
                {
                    ProviderPeriodPhase.InningTop, ProviderPeriodPhase.InningMiddle,
                    ProviderPeriodPhase.InningBottom, ProviderPeriodPhase.InningEnd,
                });
                break;
            case Sport.Cricket:
                // The clock is the overs bowled in the innings, not shown; the side batting has them too.
                Assert.Contains(game.Phase, new[] { ProviderPeriodPhase.Playing, ProviderPeriodPhase.Break });
                if (game.Phase == ProviderPeriodPhase.Playing)
                    Assert.InRange(Overs(game.Batting()!.Innings!.Overs), 0, 20);
                break;
            case Sport.Soccer:
                Assert.InRange(Minute(game), 1, 90);
                Assert.True(Minute(game) <= Math.Ceiling(-game.StartsIn.TotalMinutes), $"minute {game.Clock} {-game.StartsIn} in");
                Assert.Contains(game.Phase, new[] { ProviderPeriodPhase.Playing, ProviderPeriodPhase.Break });
                break;
            default:
                Assert.Matches(@"^\d{1,2}:\d{2}$", game.Clock);
                Assert.True(TimeSpan.Parse($"0:{game.Clock}") <= TimeSpan.FromMinutes(league.PeriodClockMinutes!.Value), $"clock {game.Clock}");
                Assert.Contains(game.Phase, new[] { ProviderPeriodPhase.Playing, ProviderPeriodPhase.Break });
                break;
        }
    }

    /// <summary>In cricket, whether the home team hasn't batted yet: it bats second, in the second innings.</summary>
    private static bool YetToBat(ProviderTeam team, ScenarioGame game, League league) =>
        league.Sport == Sport.Cricket && team == game.Sides.Home && game.Period == 1;

    /// <summary>Overs as cricket writes them ("13.2" is 13 overs and 2 balls), as a number of overs.</summary>
    private static double Overs(string? overs) =>
        overs?.Split('.') is [var whole, var balls] ? int.Parse(whole) + int.Parse(balls) / 6.0 : int.Parse(overs!);

    private static int Minute(ScenarioGame game) => int.Parse(Regex.Match(game.Clock!, @"^(\d+)'$").Groups[1].Value);

    /// <summary>Games made over many seeds, so the checks see the spread of what the maker picks.</summary>
    private static IEnumerable<(ScenarioGame Game, League League)> Make(string leagueKey, GameStatus status)
    {
        var league = Leagues.Single(l => l.Key == leagueKey);
        var maker = new ScenarioGameMaker([league], Teams);
        return Enumerable.Range(0, 200).Select(seed => (maker.Make("made", At, status, [], new Random(seed)), league)).ToList();
    }
}

file static class CricketGame
{
    /// <summary>The side batting: the one with overs bowled to it.</summary>
    public static ProviderTeam? Batting(this ScenarioGame game) =>
        game.Sides.Home.Innings?.Overs is not null ? game.Sides.Home : game.Sides.Away.Innings?.Overs is not null ? game.Sides.Away : null;
}
