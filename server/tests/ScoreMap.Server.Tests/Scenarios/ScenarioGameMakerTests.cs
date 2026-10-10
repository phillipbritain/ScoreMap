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
    ];

    private static readonly ScenarioVenue Home = Venue("Emirates Stadium", "Arsenal", "ARS");
    private static readonly ScenarioVenue[] Venues = [Home, Venue("Stamford Bridge", "Chelsea", "CHE"), Venue("Maracanã", "Flamengo", "FLA")];

    // The most each team plausibly scores in a whole game.
    private static readonly Dictionary<Sport, int> MostPoints = new()
    {
        [Sport.Football] = 50,
        [Sport.Basketball] = 140,
        [Sport.Baseball] = 12,
        [Sport.Hockey] = 8,
        [Sport.Soccer] = 6,
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
            Assert.Null(game.Home.Score);
            Assert.Null(game.Away.Score);
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
            Assert.InRange(game.Home.Score!.Value, 0, MostPoints[league.Sport]);
            Assert.InRange(game.Away.Score!.Value, 0, MostPoints[league.Sport]);
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
            Assert.InRange(game.Home.Score!.Value, 0, MostPoints[league.Sport]);
            Assert.InRange(game.Away.Score!.Value, 0, MostPoints[league.Sport]);
            Assert.Equal(league.Regulation, game.Period);
        }
    }

    [Theory]
    [MemberData(nameof(LeagueKeys))]
    public void A_final_game_in_a_sport_without_draws_never_ends_level(string leagueKey)
    {
        var games = Make(leagueKey, GameStatus.Final).ToList();
        if (games[0].League.Sport == Sport.Soccer)
            return;

        Assert.All(games, made => Assert.NotEqual(made.Game.Home.Score, made.Game.Away.Score));
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
                Assert.NotNull(game.Home.Score);
                Assert.NotNull(game.Away.Score);
                Assert.NotNull(game.Period);
            }
            else
            {
                // Shown from 3 h before the planned start until 2 h after the planned end.
                Assert.InRange(game.StartsIn, -(league.PlannedLength + GameBoard.FinalWindow) + TimeSpan.FromMinutes(30), GameBoard.UpcomingWindow);
                Assert.Null(game.Home.Score);
                Assert.Null(game.Away.Score);
            }
        }
    }

    [Fact]
    public void A_game_is_the_venues_home_team_against_another_venues_home_team_in_any_league()
    {
        var games = Leagues.SelectMany(l => Make(l.Key, GameStatus.Live)).Select(made => made.Game).ToList();

        Assert.All(games, game =>
        {
            Assert.Equal(("ARS", "Arsenal", "https://example.com/ARS.png"), (game.Home.Abbreviation, game.Home.FullName, game.Home.LogoUrl));
            Assert.Equal(Home.ToProviderVenue(), game.Venue);
            Assert.Contains(game.Away.Abbreviation, new[] { "CHE", "FLA" });
            Assert.Equal("made", game.Id);
        });
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

    private static int Minute(ScenarioGame game) => int.Parse(Regex.Match(game.Clock!, @"^(\d+)'$").Groups[1].Value);

    /// <summary>Games made over many seeds, so the checks see the spread of what the maker picks.</summary>
    private static IEnumerable<(ScenarioGame Game, League League)> Make(string leagueKey, GameStatus status)
    {
        var league = Leagues.Single(l => l.Key == leagueKey);
        var maker = new ScenarioGameMaker([league], Venues);
        return Enumerable.Range(0, 200).Select(seed => (maker.Make("made", Home, status, new Random(seed)), league)).ToList();
    }

    private static ScenarioVenue Venue(string name, string team, string abbreviation) =>
        new(name, "Somewhere", null, "Somewhere", new ScenarioTeam(team, abbreviation, $"https://example.com/{abbreviation}.png"), ["worldwide"]);
}
