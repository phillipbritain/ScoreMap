using ScoreMap.Server.GameFeed;
using ScoreMap.Server.Games;

namespace ScoreMap.Server.Scenarios;

/// <summary>
/// Makes up a game at a venue from the venue list, in a given status: two teams from the team list in
/// a random configured league, neither of them already in a game showing (ADR-0009). Its start, score
/// and clock fit its status, as its sport plays out (see <see cref="SportPlay"/>), and its start keeps
/// it inside its pin window when the scenario starts. Used by <c>fill</c>; play uses it to bring on
/// new games.
/// </summary>
public sealed class ScenarioGameMaker(IReadOnlyList<League> leagues, ScenarioTeamList teams)
{
    private static readonly ProviderStatus[] Disruptions = [ProviderStatus.Postponed, ProviderStatus.Suspended, ProviderStatus.Canceled];

    /// <summary>
    /// A game with id <paramref name="id"/> at <paramref name="venue"/> in <paramref name="status"/>,
    /// with its start relative to the scenario's (or loop's) start, between two teams of a league that
    /// aren't among <paramref name="playing"/> (each team in a game showing).
    /// A Disrupted game is <paramref name="disruption"/> (Postponed, Suspended or Canceled; see
    /// <see cref="DisruptionInTurn"/>), or one at random if left out. Every choice comes from <paramref name="random"/>, so a seeded one makes the
    /// same game each time.
    /// </summary>
    /// <exception cref="NotEnoughTeamsException">No league has two teams free to play.</exception>
    public ScenarioGame Make(
        string id, ScenarioVenue venue, GameStatus status, IEnumerable<PlayingTeam> playing, Random random,
        ProviderStatus? disruption = null)
    {
        var taken = playing.ToHashSet();
        var leaguesWithAGameFree = leagues
            .Select(league => (League: league, Free: teams.For(league).Where(team => !taken.Contains(new(league.Key, team.Name))).ToList()))
            .Where(league => league.Free.Count >= 2)
            .ToList();
        if (leaguesWithAGameFree.Count == 0)
            throw new NotEnoughTeamsException(
                $"Can't make game \"{id}\": no league has two teams free to play; add teams to the scenario team list or ask for fewer games");
        var (league, free) = leaguesWithAGameFree[random.Next(leaguesWithAGameFree.Count)];
        var home = free[random.Next(free.Count)];
        free.Remove(home);
        var away = free[random.Next(free.Count)];
        var game = new ScenarioGame(
            Id: id,
            LeagueKey: league.Key,
            StartsIn: TimeSpan.Zero,
            Home: Team(home),
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
            GameStatus.Disrupted => Disrupted(game, league, sport, disruption ?? Disruptions[random.Next(Disruptions.Length)], random),
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
    private static ScenarioGame Disrupted(ScenarioGame game, League league, SportPlay sport, ProviderStatus status, Random random)
    {
        return status == ProviderStatus.Suspended
            ? UnderWay(game, league, sport, random) with { Status = status }
            : game with { StartsIn = Minutes(random.Next(-30, 121)), Status = status };
    }

    /// <summary>
    /// The way the <paramref name="n"/>th (from 0) of a batch of Disrupted games is disrupted: Postponed,
    /// Suspended and Canceled in turn, so a few Disrupted games show every kind.
    /// </summary>
    public static ProviderStatus DisruptionInTurn(int n) => Disruptions[n % Disruptions.Length];

    private static TimeSpan Minutes(int minutes) => TimeSpan.FromMinutes(minutes);

    private static ProviderTeam Team(ScenarioTeam team) => new(team.Abbreviation, team.Name, team.LogoUrl, null);
}

/// <summary>A team in a game showing, by its league's key and its name, which the game maker won't put in another game.</summary>
public readonly record struct PlayingTeam(string LeagueKey, string Team)
{
    /// <summary>The two teams of a game in league <paramref name="leagueKey"/>.</summary>
    public static IEnumerable<PlayingTeam> In(string leagueKey, ProviderTeam home, ProviderTeam away) =>
        [new(leagueKey, home.FullName), new(leagueKey, away.FullName)];
}

/// <summary>Thrown when no league has two teams free to play, so the game maker can't make another game.</summary>
public sealed class NotEnoughTeamsException(string message) : InvalidOperationException(message);
