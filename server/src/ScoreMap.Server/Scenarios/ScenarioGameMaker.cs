using ScoreMap.Server.Sports;
using ScoreMap.Server.GameFeed;
using ScoreMap.Server.Games;

namespace ScoreMap.Server.Scenarios;

/// <summary>
/// Makes up a game at a venue from the venue list, in a given status: two teams from the team list in
/// a random configured league, neither of them already in a game showing (ADR-0009). Its start, score
/// and clock fit its status, as its sport plays out (see <see cref="SidesPlay"/>), and its start keeps
/// it inside its pin window when the scenario starts. Used by <c>fill</c>; play uses it to bring on
/// new games.
/// </summary>
public sealed class ScenarioGameMaker(IReadOnlyList<League> leagues, ScenarioTeamList teams)
{
    /// <summary>
    /// A game with id <paramref name="id"/> at <paramref name="venue"/> in <paramref name="status"/>,
    /// with its start relative to the scenario's (or loop's) start, between two teams of a league that
    /// aren't among <paramref name="playing"/> (each team in a game showing).
    /// Every choice comes from <paramref name="random"/>, so a seeded one makes the same game each time.
    /// </summary>
    /// <exception cref="NotEnoughTeamsException">No league has two teams free to play.</exception>
    public ScenarioGame Make(
        string id, ScenarioVenue venue, GameStatus status, IEnumerable<PlayingTeam> playing, Random random)
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
            Contest: new ProviderSides(Team(home), Team(away)),
            Venue: venue.ToProviderVenue(),
            Status: ProviderStatus.Scheduled,
            Clock: null,
            Period: null,
            Phase: ProviderPeriodPhase.Playing);

        var sport = ScenarioSports.For(league).CreatePlay();
        return status switch
        {
            // Within the Upcoming window, so it has its pin from the start.
            GameStatus.Upcoming => game with { StartsIn = Minutes(random.Next(5, 31)) },
            GameStatus.Live => UnderWay(game, league, sport, random),
            GameStatus.Final => Finished(game, league, sport, random),
            _ => throw new ArgumentOutOfRangeException(nameof(status), status, "No such status"),
        };
    }

    /// <summary>
    /// Live: started anywhere within the planned length, short of its end, standing where its sport would be that far through its
    /// planned length (in cricket, perhaps further, past an innings over early): its period, clock,
    /// phase (perhaps a break) and score.
    /// </summary>
    private static ScenarioGame UnderWay(ScenarioGame game, League league, SidesPlay sport, Random random)
    {
        var minutesIn = random.Next(1, (int)league.PlannedLength.TotalMinutes);
        var made = sport.Live(game.Sides.Home, game.Sides.Away, minutesIn / league.PlannedLength.TotalMinutes, random);
        return Standing(game, made) with { StartsIn = Minutes(-minutesIn), Status = ProviderStatus.InProgress };
    }

    /// <summary>
    /// Final: started a whole game and up to 3 minutes more ago, with a whole game's score (never level
    /// in a sport without draws). The board takes a game first seen Final to have ended at its planned end
    /// and shows it for the Final window after (5 minutes), so it keeps its pin a couple of minutes at least.
    /// </summary>
    private static ScenarioGame Finished(ScenarioGame game, League league, SidesPlay sport, Random random)
    {
        var startsIn = -(league.PlannedLength + Minutes(random.Next(0, 4)));
        var made = sport.Final(game.Sides.Home, game.Sides.Away, random);
        return Standing(game, made) with { StartsIn = startsIn, Status = ProviderStatus.Final };
    }

    private static ScenarioGame Standing(ScenarioGame game, MadeUp made) => game with
    {
        Contest = new ProviderSides(made.Home, made.Away),
        Period = made.Period,
        Clock = made.Clock,
        Phase = made.Phase,
    };

    private static TimeSpan Minutes(int minutes) => TimeSpan.FromMinutes(minutes);

    private static ProviderTeam Team(ScenarioTeam team) =>
        new(team.Abbreviation, team.Name, team.LogoUrl, null, ConferenceId: team.ConferenceId);
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
