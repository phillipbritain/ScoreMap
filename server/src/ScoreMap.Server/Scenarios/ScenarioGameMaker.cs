using ScoreMap.Server.GameFeed;
using ScoreMap.Server.Games;

namespace ScoreMap.Server.Scenarios;

/// <summary>
/// Makes up a game at a venue from the venue list, in a given status: the venue's home team against
/// another venue's home team, in a random configured league (odd pairings included, ADR-0009). Its
/// start, score and clock fit its status, as its sport plays out (see <see cref="SportPlay"/>), and its
/// start keeps it inside its pin window when the scenario starts. Used by <c>fill</c>; random play uses
/// it to bring on new games.
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

        var sport = new SportPlay(league);
        return status switch
        {
            GameStatus.Upcoming => game with { StartsIn = Minutes(random.Next(5, 171)) },
            GameStatus.Live => UnderWay(game, league, sport, random),
            GameStatus.Final => Finished(game, league, sport, random),
            GameStatus.Disrupted => Disrupted(game, league, sport, random),
            _ => throw new ArgumentOutOfRangeException(nameof(status), status, "No such status"),
        };
    }

    /// <summary>
    /// Live: started up to 90% of a game ago, standing where its sport would be that far through its
    /// planned length: its period, clock, phase (perhaps a break) and score.
    /// </summary>
    private static ScenarioGame UnderWay(ScenarioGame game, League league, SportPlay sport, Random random)
    {
        var minutesIn = random.Next(1, (int)(league.PlannedLength.TotalMinutes * 0.9) + 1);
        var through = minutesIn / league.PlannedLength.TotalMinutes;
        var (period, clock, phase) = sport.Position(through);
        return game with
        {
            StartsIn = Minutes(-minutesIn),
            Status = ProviderStatus.InProgress,
            Home = game.Home with { Score = sport.ScoreAt(through, random) },
            Away = game.Away with { Score = sport.ScoreAt(through, random) },
            Period = period,
            Clock = clock,
            Phase = phase,
        };
    }

    /// <summary>
    /// Final: started a whole game and up to an hour more ago, with a whole game's score (never level in
    /// a sport without draws). The board takes a game first seen Final to have ended at its planned end
    /// and shows it for two hours after, so it keeps its pin a while.
    /// </summary>
    private static ScenarioGame Finished(ScenarioGame game, League league, SportPlay sport, Random random)
    {
        var startsIn = -(league.PlannedLength + Minutes(random.Next(5, 61)));
        var (home, away) = sport.Settled(sport.ScoreAt(1, random), sport.ScoreAt(1, random), random);
        return game with
        {
            StartsIn = startsIn,
            Status = ProviderStatus.Final,
            Home = game.Home with { Score = home },
            Away = game.Away with { Score = away },
            Period = sport.Regulation,
        };
    }

    /// <summary>
    /// Disrupted: suspended part way through with its score so far, or postponed or canceled around
    /// its planned start with no score.
    /// </summary>
    private static ScenarioGame Disrupted(ScenarioGame game, League league, SportPlay sport, Random random)
    {
        var status = Disruptions[random.Next(Disruptions.Length)];
        return status == ProviderStatus.Suspended
            ? UnderWay(game, league, sport, random) with { Status = status }
            : game with { StartsIn = Minutes(random.Next(-30, 121)), Status = status };
    }

    private static TimeSpan Minutes(int minutes) => TimeSpan.FromMinutes(minutes);

    private static ProviderTeam Team(ScenarioTeam team) => new(team.Abbreviation, team.Name, team.LogoUrl, null);
}
