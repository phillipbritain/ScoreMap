using System.Globalization;
using ScoreMap.Server.GameFeed;
using ScoreMap.Server.Games;

namespace ScoreMap.Server.Scenarios;

/// <summary>
/// Makes up the game panel's extra detail for a scenario's games (ADR-0009), as ESPN would give it for
/// real ones: each team's record (and in college sports perhaps a ranking), now and then a note on the
/// game (a playoff round, say), a betting line, the crowd once
/// a game has started, and while it's Live where play stands. Each comes from a seed of the game or team,
/// so it's the same every time a game is asked for. A game's last score is made up as its score changes
/// (the team whose score went up scored, as its sport scores), and for a game first seen with a score,
/// from that score; in soccer its goals, and cards now and then, come with the minute they came in.
/// Cricket has no last score or situation, as ESPN gives none.
/// </summary>
internal sealed class ScenarioDetails(IReadOnlyList<League> leagues)
{
    private readonly Dictionary<string, League> _leagues = leagues.ToDictionary(league => league.Key);

    // Each game's scores when last seen, its last score and (soccer) its goals and cards, by game id.
    private readonly Dictionary<string, Seen> _seen = new();

    private sealed record Seen(int? Home, int? Away, ProviderScoringPlay? LastScore, IReadOnlyList<ProviderKeyEvent> KeyEvents, int Minute);

    /// <summary>
    /// The league's games, with their detail made up. Games of a league the server doesn't show come back
    /// as they are. Not thread-safe: the poller asks for one league at a time.
    /// </summary>
    public IReadOnlyList<ProviderGame> Fill(string leagueKey, IReadOnlyList<ProviderGame> games)
    {
        if (!_leagues.TryGetValue(leagueKey, out var league))
            return games;
        var ids = games.Select(game => game.Id).ToHashSet();
        foreach (var id in _seen.Keys.Where(id => id.StartsWith($"{leagueKey}/", StringComparison.Ordinal) && !ids.Contains(id[(leagueKey.Length + 1)..])).ToList())
            _seen.Remove(id);
        return games.Select(game => Fill(game, league)).ToList();
    }

    private ProviderGame Fill(ProviderGame game, League league)
    {
        var started = game.Home.Score is not null || game.Away.Score is not null;
        game = game with
        {
            Home = WithRecord(game.Home, league),
            Away = WithRecord(game.Away, league),
            Note = Note(game, league),
            Odds = league.Sport == Sport.Cricket ? null : Odds(game, league),
            Attendance = started ? Attendance(game, league) : null,
        };
        if (!started || league.Sport == Sport.Cricket)
            return game;

        var key = $"{league.Key}/{game.Id}";
        var seen = _seen.GetValueOrDefault(key);
        // A Final game has no clock, so has played its whole game.
        var minute = league.Sport != Sport.Soccer ? 0
            : game.Status == ProviderStatus.Final ? league.Regulation * (league.PeriodClockMinutes ?? 45)
            : SoccerMinute(game.DisplayClock);
        var (lastScore, keyEvents) = league.Sport == Sport.Soccer
            ? SoccerEvents(game, seen, minute)
            : (Scored(game, league, seen) ?? seen?.LastScore, (IReadOnlyList<ProviderKeyEvent>)[]);
        _seen[key] = new Seen(game.Home.Score, game.Away.Score, lastScore, keyEvents, Math.Max(minute, seen?.Minute ?? 0));

        return game with
        {
            LastScore = lastScore,
            KeyEvents = keyEvents,
            Situation = game.Status == ProviderStatus.InProgress && game.Phase is not ProviderPeriodPhase.Break
                ? Situation(game, league)
                : null,
        };
    }

    // Records and rankings.

    /// <summary>
    /// The team's record, from a seed of its league and name: in soccer wins, draws and losses, in hockey
    /// wins, losses and overtime losses, elsewhere wins and losses, over a season part way through. In a
    /// college league, about a quarter of teams are ranked.
    /// </summary>
    private static ProviderTeam WithRecord(ProviderTeam team, League league)
    {
        if (league.Sport == Sport.Cricket)
            return team;
        var random = Seeded(league.Key, team.FullName);
        var played = league.Sport switch
        {
            Sport.Football => random.Next(2, 13),
            Sport.Baseball => random.Next(20, 150),
            Sport.Soccer => random.Next(3, 30),
            _ => random.Next(5, 60),
        };
        var wins = random.Next(played + 1);
        var record = league.Sport switch
        {
            Sport.Soccer when random.Next(played - wins + 1) is var draws => $"{wins}-{draws}-{played - wins - draws}",
            Sport.Hockey when random.Next((played - wins) / 3 + 1) is var overtime => $"{wins}-{played - wins - overtime}-{overtime}",
            _ => $"{wins}-{played - wins}",
        };
        var college = league.Key.Contains("college", StringComparison.Ordinal);
        return team with { Record = record, Rank = college && random.NextDouble() < 0.25 ? random.Next(1, 26) : null };
    }

    // Notes, odds and attendance.

    /// <summary>A note on about one game in six, from a seed of the game, of the kind its sport's games get.</summary>
    private static string? Note(ProviderGame game, League league)
    {
        var random = Seeded(game.Id, "note");
        if (random.NextDouble() >= 1.0 / 6)
            return null;
        return league.Sport switch
        {
            Sport.Football => Pick(random, "Rivalry Week", "Homecoming", "Wild Card Playoffs", "International Series"),
            Sport.Basketball => Pick(random, "Play-In Tournament", $"Conference Semifinals - Game {random.Next(1, 8)}", "Cup Knockout Round"),
            Sport.Baseball => Pick(random, $"Division Series - Game {random.Next(1, 6)}", "Doubleheader - Game 2", "Inclement Weather - Makeup date"),
            Sport.Hockey => Pick(random, $"First Round - Game {random.Next(1, 8)}", "Outdoor Game", "Rivalry Night"),
            Sport.Soccer => Pick(random, "1st Leg", $"2nd Leg - Aggregate {random.Next(4)}-{random.Next(4)}", "Derby"),
            _ => Pick(random, "Qualifier 1", "Eliminator", "Final"),
        };
    }

    /// <summary>A betting line from a seed of the game: a favourite by its sport's usual margin, and a total.</summary>
    private static ProviderOdds Odds(ProviderGame game, League league)
    {
        var random = Seeded(game.Id, "odds");
        var favourite = random.Next(2) == 0 ? game.Home : game.Away;
        double Between(double low, double high, double step) => low + step * random.Next((int)((high - low) / step) + 1);
        var (line, total) = league.Sport switch
        {
            Sport.Football => ($"{favourite.Abbreviation} -{Number(Between(1, 14, 0.5))}", Between(37.5, 55.5, 1)),
            Sport.Basketball when league.Regulation == 2 => ($"{favourite.Abbreviation} -{Number(Between(1, 15, 0.5))}", Between(128.5, 158.5, 1)),
            Sport.Basketball when league.PeriodClockMinutes == 10 => ($"{favourite.Abbreviation} -{Number(Between(1, 12, 0.5))}", Between(150.5, 172.5, 1)),
            Sport.Basketball => ($"{favourite.Abbreviation} -{Number(Between(1, 13, 0.5))}", Between(208.5, 241.5, 1)),
            Sport.Baseball => ($"{favourite.Abbreviation} -{random.Next(110, 220)}", Between(6.5, 10.5, 0.5)),
            Sport.Hockey => ($"{favourite.Abbreviation} -{random.Next(110, 200)}", Between(5.5, 6.5, 1)),
            _ => ($"{favourite.Abbreviation} -{random.Next(105, 260)}", Between(2.5, 3.5, 1)),
        };
        return new ProviderOdds(line, total, "DraftKings");
    }

    /// <summary>The crowd, from a seed of the game: most of a full house for its sport.</summary>
    private static int Attendance(ProviderGame game, League league)
    {
        var fullHouse = league.Sport switch
        {
            Sport.Football when league.Key.Contains("college", StringComparison.Ordinal) => 85000,
            Sport.Football => 68000,
            Sport.Baseball => 40000,
            Sport.Soccer => 45000,
            Sport.Cricket => 33000,
            _ => 18500,
        };
        return (int)(fullHouse * (0.6 + 0.4 * Seeded(game.Id, "crowd").NextDouble()));
    }

    // Last scores.

    /// <summary>
    /// A score for the team whose score went up since the game was last seen (the home team's, if both
    /// did), worth what it went up by; or for a game first seen with a score, one by a team that has
    /// scored, of its sport's usual size. Null when the score hasn't changed.
    /// </summary>
    private static ProviderScoringPlay? Scored(ProviderGame game, League league, Seen? seen)
    {
        var (home, away) = (game.Home.Score ?? 0, game.Away.Score ?? 0);
        int homeGained, awayGained;
        if (seen is not null)
            (homeGained, awayGained) = (home - (seen.Home ?? 0), away - (seen.Away ?? 0));
        else
        {
            var usual = league.Sport switch { Sport.Football => 7, Sport.Basketball => 2, _ => 1 };
            var homeScored = home > 0 && (away == 0 || Seeded(game.Id, "first").Next(2) == 0);
            (homeGained, awayGained) = homeScored ? (Math.Min(usual, home), 0) : (0, Math.Min(usual, away));
        }
        if (homeGained <= 0 && awayGained <= 0)
            return null;

        var team = homeGained > 0 ? game.Home : game.Away;
        var points = homeGained > 0 ? homeGained : awayGained;
        var random = Seeded(game.Id, $"{home}-{away}");
        var text = league.Sport switch
        {
            Sport.Football => FootballScore(points, random),
            Sport.Basketball => BasketballScore(points, random),
            Sport.Baseball => BaseballScore(points, random),
            _ => $"{Player(random)} Goal ({random.Next(1, 30)}) {Pick(random, "Wrist Shot", "Snap Shot", "Slap Shot", "Backhand", "Tip-In")}, assists: {Player(random)}",
        };
        var phase = league.Sport == Sport.Baseball ? game.Phase : ProviderPeriodPhase.Playing;
        return new ProviderScoringPlay(team.Abbreviation, text, game.Period, league.Sport == Sport.Baseball ? null : game.DisplayClock, phase);
    }

    private static string FootballScore(int points, Random random) => points switch
    {
        3 => $"{Player(random)} {random.Next(20, 56)} Yd Field Goal",
        2 => $"{Player(random)} Safety",
        _ when random.Next(2) == 0 => $"{Player(random)} {random.Next(1, 40)} Yd Run ({Player(random)} Kick)",
        _ => $"{Player(random)} {random.Next(1, 60)} Yd pass from {Player(random)} ({Player(random)} Kick)",
    };

    private static string BasketballScore(int points, Random random) => points switch
    {
        1 => $"{Player(random)} makes free throw {Pick(random, "1 of 2", "2 of 2", "1 of 1")}",
        2 => $"{Player(random)} makes {Pick(random, $"{random.Next(2, 20)}-foot jumper", "driving layup", "dunk", "two point shot")} ({Player(random)} assists)",
        _ => $"{Player(random)} makes {random.Next(23, 30)}-foot three point jumper ({Player(random)} assists)",
    };

    private static string BaseballScore(int runs, Random random) => runs switch
    {
        1 when random.Next(3) == 0 => $"{Player(random)} homered to {Pick(random, "left", "center", "right")} ({random.Next(340, 460)} feet).",
        1 => $"{Player(random)} {Pick(random, "singled", "doubled", "hit a sacrifice fly")} to {Pick(random, "left", "center", "right")}, {Player(random)} scored.",
        4 => $"{Player(random)} hit a grand slam to {Pick(random, "left", "center", "right")} ({random.Next(360, 460)} feet).",
        _ => $"{Player(random)} {Pick(random, "doubled", "tripled", "homered")} to {Pick(random, "left", "center", "right")}, {runs} runs scored.",
    };

    // Soccer's goals and cards.

    /// <summary>
    /// Soccer's goals and cards so far. A goal since the game was last seen comes in at the current minute;
    /// a game first seen with goals gets them at minutes before it. Cards come now and then, from a seed of
    /// the game and minute. The last score is the last goal.
    /// </summary>
    private static (ProviderScoringPlay? LastScore, IReadOnlyList<ProviderKeyEvent> KeyEvents) SoccerEvents(ProviderGame game, Seen? seen, int minute)
    {
        var events = seen?.KeyEvents.ToList() ?? [];
        var from = seen?.Minute ?? 0;
        var (home, away) = (game.Home.Score ?? 0, game.Away.Score ?? 0);
        var goals = new List<(int Minute, ProviderTeam Team)>();
        void GoalsFor(ProviderTeam team, int had, int has)
        {
            for (var goal = had + 1; goal <= has; goal++)
                goals.Add((seen is null ? Seeded(game.Id, $"{team.Abbreviation} {goal}").Next(1, Math.Max(2, minute)) : minute, team));
        }
        GoalsFor(game.Home, seen?.Home ?? 0, home);
        GoalsFor(game.Away, seen?.Away ?? 0, away);
        foreach (var (at, team) in goals)
        {
            var random = Seeded(game.Id, $"goal {team.Abbreviation} {at}");
            var kind = random.NextDouble() switch { < 0.1 => KeyEventKind.PenaltyGoal, < 0.13 => KeyEventKind.OwnGoal, _ => KeyEventKind.Goal };
            events.Add(new ProviderKeyEvent(kind, team.Abbreviation, Player(random), $"{at}'"));
        }
        for (var at = from + 1; at <= minute; at++)
        {
            var random = Seeded(game.Id, $"card {at}");
            var roll = random.NextDouble();
            if (roll < 0.035)
                events.Add(new ProviderKeyEvent(roll < 0.003 ? KeyEventKind.RedCard : KeyEventKind.YellowCard,
                    (random.Next(2) == 0 ? game.Home : game.Away).Abbreviation, Player(random), $"{at}'"));
        }
        // In the order they came; a goal and a card in the same minute, the goal first.
        var ordered = events.OrderBy(e => SoccerMinute(e.Clock)).ToList();
        var last = ordered.LastOrDefault(e => e.Kind is KeyEventKind.Goal or KeyEventKind.PenaltyGoal or KeyEventKind.OwnGoal);
        var text = last is null ? null : (last.Kind switch { KeyEventKind.PenaltyGoal => "Penalty", KeyEventKind.OwnGoal => "Own goal", _ => "Goal" }) + $": {last.Player}";
        var lastScore = last is null ? null : new ProviderScoringPlay(last.Team, text!, null, last.Clock);
        return (lastScore, ordered);
    }

    /// <summary>The minute of a soccer clock such as "67'", or 0 when there's none.</summary>
    private static int SoccerMinute(string? clock) =>
        int.TryParse(new string((clock ?? "").TakeWhile(char.IsAsciiDigit).ToArray()), out var minute) ? minute : 0;

    // Situations.

    /// <summary>
    /// Where play stands, from a seed of the game as it stands (its period, the minute on its clock and its
    /// score), so it moves on as the game does and stays put in a game that doesn't: in football the down
    /// and distance and who has the ball, in baseball the count, outs and runners, and in basketball and
    /// hockey the last play. Soccer has none, as ESPN gives none.
    /// </summary>
    private static ProviderSituation? Situation(ProviderGame game, League league)
    {
        var clockMinute = (game.DisplayClock ?? "").Split(':')[0];
        var random = Seeded(game.Id, $"situation {game.Period} {game.Phase} {clockMinute} {game.Home.Score}-{game.Away.Score}");
        switch (league.Sport)
        {
            case Sport.Football:
                var (offence, defence) = random.Next(2) == 0 ? (game.Home, game.Away) : (game.Away, game.Home);
                var down = random.Next(1, 5);
                var distance = down == 1 ? 10 : random.Next(1, 11);
                var yardLine = random.Next(1, 50);
                var side = random.Next(2) == 0 ? offence : defence;
                var lastPlay = Pick(random,
                    $"{Player(random)} run for {random.Next(-2, 15)} yards",
                    $"{Player(random)} pass short {Pick(random, "left", "middle", "right")} to {Player(random)} for {random.Next(1, 20)} yards",
                    $"{Player(random)} pass incomplete deep {Pick(random, "left", "right")} to {Player(random)}");
                return new ProviderSituation(lastPlay, $"{Ordinal(down)} & {distance} at {side.Abbreviation} {yardLine}", offence.Abbreviation);
            case Sport.Baseball:
                return new ProviderSituation(
                    Pick(random, $"{Player(random)} struck out swinging.", $"{Player(random)} grounded out to second.", $"{Player(random)} flied out to center.", $"{Player(random)} walked."),
                    Balls: random.Next(4), Strikes: random.Next(3), Outs: random.Next(3),
                    OnFirst: random.NextDouble() < 0.35, OnSecond: random.NextDouble() < 0.25, OnThird: random.NextDouble() < 0.15);
            case Sport.Basketball:
                return new ProviderSituation(Pick(random,
                    $"{Player(random)} defensive rebound",
                    $"{Player(random)} misses {random.Next(10, 27)}-foot jumper",
                    $"{Player(random)} bad pass (stolen by {Player(random)})",
                    $"{Player(random)} shooting foul"));
            case Sport.Hockey:
                return new ProviderSituation(Pick(random,
                    $"{Player(random)} won faceoff against {Player(random)}",
                    $"Shot on goal by {Player(random)} saved by {Player(random)}",
                    $"{Player(random)} hit {Player(random)}",
                    $"Takeaway by {Player(random)}"));
            default:
                return null;
        }
    }

    // Helpers.

    private static readonly string[] FirstNames =
    [
        "Alex", "Jordan", "Marcus", "Tyler", "Chris", "Jamal", "Luis", "Mateo", "Ryan", "Kevin", "Andre", "Sam",
        "Nico", "Darius", "Owen", "Ethan", "Leo", "Isaac", "Theo", "Miles", "Caleb", "Hugo", "Felix", "Jonah",
    ];

    private static readonly string[] LastNames =
    [
        "Carter", "Reyes", "Okafor", "Lindqvist", "Brooks", "Nakamura", "Silva", "Dubois", "Kowalski", "Hayes",
        "Mensah", "Fischer", "Moreno", "Walsh", "Petrov", "Bennett", "Adeyemi", "Larsen", "Costa", "Murphy",
        "Novak", "Ortiz", "Grant", "Haddad",
    ];

    private static string Player(Random random) => $"{Pick(random, FirstNames)} {Pick(random, LastNames)}";

    private static string Pick(Random random, params string[] choices) => choices[random.Next(choices.Length)];

    private static Random Seeded(string a, string b) => new(Scenario.StableSeed($"{a}\u0001{b}"));

    private static string Number(double value) => value.ToString(CultureInfo.InvariantCulture);

    private static string Ordinal(int n) => n switch { 1 => "1st", 2 => "2nd", 3 => "3rd", _ => $"{n}th" };
}
