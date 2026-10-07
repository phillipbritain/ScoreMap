using ScoreMap.Server.GameFeed;
using ScoreMap.Server.Games;

namespace ScoreMap.Server.Scenarios;

/// <summary>
/// Makes up a game at a venue from the venue list, in a given status: the venue's home team against
/// another venue's home team, in a random configured league (odd pairings included, ADR-0009). Its
/// start, score and clock fit its status, and its start keeps it inside its pin window when the
/// scenario starts. Used by <c>fill</c>; random play can use it to bring on new games.
/// </summary>
public sealed class ScenarioGameMaker(IReadOnlyList<League> leagues, IReadOnlyList<ScenarioVenue> venues)
{
    private static readonly ProviderStatus[] Disruptions = [ProviderStatus.Postponed, ProviderStatus.Suspended, ProviderStatus.Canceled];

    /// <summary>
    /// A game with id <paramref name="id"/> at <paramref name="venue"/> in <paramref name="status"/>,
    /// with its start relative to the scenario's (or loop's) start. Every choice comes from
    /// <paramref name="random"/>, so a seeded one makes the same game each time.
    /// </summary>
    public ScenarioGame Make(string id, ScenarioVenue venue, GameStatus status, Random random)
    {
        var league = leagues[random.Next(leagues.Count)];
        var awayTeams = venues.Select(v => v.HomeTeam).Where(team => team.Name != venue.HomeTeam.Name).ToList();
        var away = awayTeams.Count > 0 ? awayTeams[random.Next(awayTeams.Count)] : new ScenarioTeam("Visitors", "VIS", null);
        var game = new ScenarioGame(
            Id: id,
            LeagueKey: league.Key,
            StartsIn: TimeSpan.Zero,
            Home: Team(venue.HomeTeam),
            Away: Team(away),
            Venue: venue.ToProviderVenue(),
            Status: ProviderStatus.Scheduled,
            Clock: null,
            Period: null,
            Phase: ProviderPeriodPhase.Playing);

        return status switch
        {
            GameStatus.Upcoming => game with { StartsIn = Minutes(random.Next(5, 171)) },
            GameStatus.Live => UnderWay(game, league, random),
            GameStatus.Final => Finished(game, league, random),
            GameStatus.Disrupted => Disrupted(game, league, random),
            _ => throw new ArgumentOutOfRangeException(nameof(status), status, "No such status"),
        };
    }

    /// <summary>Live: started up to 90% of a game ago, with the clock, period and score of a game that far in.</summary>
    private static ScenarioGame UnderWay(ScenarioGame game, League league, Random random)
    {
        var minutesIn = random.Next(1, (int)(league.PlannedLength.TotalMinutes * 0.9) + 1);
        var played = minutesIn / league.PlannedLength.TotalMinutes;
        var (period, clock, phase) = Clock(league, minutesIn, played, random);
        return game with
        {
            StartsIn = Minutes(-minutesIn),
            Status = ProviderStatus.InProgress,
            Home = game.Home with { Score = Points(league, played, random) },
            Away = game.Away with { Score = Points(league, played, random) },
            Period = period,
            Clock = clock,
            Phase = phase,
        };
    }

    /// <summary>
    /// Final: started a whole game and up to an hour more ago. The board takes a game first seen Final
    /// to have ended at its planned end and shows it for two hours after, so it keeps its pin a while.
    /// </summary>
    private static ScenarioGame Finished(ScenarioGame game, League league, Random random) => game with
    {
        StartsIn = -(league.PlannedLength + Minutes(random.Next(5, 61))),
        Status = ProviderStatus.Final,
        Home = game.Home with { Score = Points(league, 1, random) },
        Away = game.Away with { Score = Points(league, 1, random) },
        Period = Regulation(league),
    };

    /// <summary>
    /// Disrupted: suspended part way through with its score so far, or postponed or canceled around
    /// its planned start with no score.
    /// </summary>
    private static ScenarioGame Disrupted(ScenarioGame game, League league, Random random)
    {
        var status = Disruptions[random.Next(Disruptions.Length)];
        return status == ProviderStatus.Suspended
            ? UnderWay(game, league, random) with { Status = status }
            : game with { StartsIn = Minutes(random.Next(-30, 121)), Status = status };
    }

    /// <summary>Where a game <paramref name="minutesIn"/> minutes in stands, in its sport's terms.</summary>
    private static (int Period, string? Clock, ProviderPeriodPhase Phase) Clock(League league, int minutesIn, double played, Random random)
    {
        var regulation = Regulation(league);
        switch (league.Sport)
        {
            case Sport.Soccer:
                // 45 minutes, a 15-minute halftime, then the second half, with stoppage time at 90'.
                if (minutesIn <= 45)
                    return (1, $"{minutesIn}'", ProviderPeriodPhase.Playing);
                if (minutesIn <= 60)
                    return (1, "45'", ProviderPeriodPhase.Break);
                return (2, $"{Math.Min(90, minutesIn - 15)}'", ProviderPeriodPhase.Playing);
            case Sport.Baseball:
                var inning = Math.Min(regulation, (int)(played * regulation) + 1);
                return (inning, null, random.Next(2) == 0 ? ProviderPeriodPhase.InningTop : ProviderPeriodPhase.InningBottom);
            default:
                // A running clock counting down each period, as far through the periods as the game is through its length.
                var periodMinutes = league.Sport switch
                {
                    Sport.AmericanFootball => 15,
                    Sport.Basketball => regulation == 2 ? 20 : 12,
                    _ => 20,
                };
                var through = played * regulation;
                var period = Math.Min(regulation, (int)through + 1);
                var left = TimeSpan.FromMinutes(Math.Max(0, period - through) * periodMinutes);
                return (period, $"{(int)left.TotalMinutes}:{left.Seconds:00}", ProviderPeriodPhase.Playing);
        }
    }

    /// <summary>One team's score <paramref name="played"/> of the way through a game, at roughly the sport's margins.</summary>
    private static int Points(League league, double played, Random random)
    {
        int UpTo(int most) => random.Next(0, (int)Math.Floor(most * played) + 1);
        return league.Sport switch
        {
            Sport.AmericanFootball => 7 * UpTo(5) + 3 * UpTo(3),
            Sport.Basketball => (int)Math.Floor((Regulation(league) == 2 ? random.Next(55, 86) : random.Next(85, 126)) * played),
            Sport.Baseball => UpTo(10),
            Sport.Hockey => UpTo(6),
            _ => UpTo(4),
        };
    }

    private static int Regulation(League league) => league.RegulationPeriods ?? league.Sport switch
    {
        Sport.Baseball => 9,
        Sport.Hockey => 3,
        Sport.Soccer => 2,
        _ => 4,
    };

    private static TimeSpan Minutes(int minutes) => TimeSpan.FromMinutes(minutes);

    private static ProviderTeam Team(ScenarioTeam team) => new(team.Abbreviation, team.Name, team.LogoUrl, null);
}
