using System.Globalization;
using ScoreMap.Server.GameFeed;
using ScoreMap.Server.Games;
using ScoreMap.Server.Sports;
using ScoreMap.Server.Sports.Shared;
using static ScoreMap.Server.Sports.Shared.ScenarioFabrication;

namespace ScoreMap.Server.Scenarios;

/// <summary>
/// The event panel's details for a made-up game (a scenario's, a demo's or the welcome tour's), shaped as
/// ESPN's summary is mapped so the panel needs nothing of its own for them: something in each tab the
/// game's sport has, made up from the game itself. Each part is picked by the game's id, so a game gets
/// the same details every time it's asked about, and they grow as it goes on: a period's score once it
/// has begun, scoring plays as its scores rise, drives and players' stats in step with how far through
/// it is. Nothing need add up (a line score needn't sum to the score), but nothing is below zero, and
/// only football has drives. A game not yet started has only a preview video and its networks. Videos
/// go to ESPN's home page, as a scenario game's ESPN link does (see <see cref="ScenarioLinks"/>).
/// </summary>
public static class ScenarioGameDetails
{
    private const string VideoPage = "https://www.espn.com/";

    public static GameDetails For(League league, ProviderGame game)
    {
        if (league.Sport == Sport.Tennis && game.Contest is ProviderSides)
            game = TennisScenario.Written(game);
        var broadcasts = Broadcasts(league, game);
        if (!Started(game))
            return GameDetails.Empty with { Videos = Videos(league, game, progress: 0), Broadcasts = broadcasts };

        var progress = Progress(league, game);
        var videos = Videos(league, game, progress);
        switch (game.Contest)
        {
            case ProviderSides sides:
                var periods = PlayedPeriods(league, game);
                return new GameDetails(
                    PeriodScores(league, game, periods), sides.Home.Score?.ToString(CultureInfo.InvariantCulture),
                    sides.Away.Score?.ToString(CultureInfo.InvariantCulture), Scoring(league, game, periods),
                    league.Sport == Sport.Football ? Drives(game, progress) : [],
                    [TeamStats(league, game, sides.Home, progress), TeamStats(league, game, sides.Away, progress)],
                    videos, broadcasts);
            case ProviderField field:
                var leaders = FieldStats(league, game, field);
                return GameDetails.Empty with
                {
                    Stats = leaders.Players.Count > 0 ? [new GameStatTeam(league.Name, [leaders])] : [],
                    Videos = videos,
                    Broadcasts = broadcasts,
                };
            case ProviderBouts card:
                var bouts = BoutStats(game, card);
                return GameDetails.Empty with
                {
                    Stats = bouts.Count > 0 ? [new GameStatTeam(league.Name, bouts)] : [],
                    Videos = videos,
                    Broadcasts = broadcasts,
                };
            default:
                return GameDetails.Empty with { Videos = videos, Broadcasts = broadcasts };
        }
    }

    private static bool Started(ProviderGame game) =>
        game.Status is ProviderStatus.InProgress or ProviderStatus.Delayed or ProviderStatus.Final or ProviderStatus.Suspended
        && game.Contest switch
        {
            ProviderSides sides => sides.Home.Score is not null || sides.Away.Score is not null,
            ProviderBouts card => card.Bouts.Any(bout => bout.Status != ProviderStatus.Scheduled),
            _ => true,
        };

    /// <summary>How far through the game is, from a little above 0 to 1 once it's over.</summary>
    private static double Progress(League league, ProviderGame game)
    {
        if (game.Status == ProviderStatus.Final)
            return 1;
        return game.Contest switch
        {
            ProviderBouts card => Math.Max(0.1, (double)card.Bouts.Count(bout => bout.Status != ProviderStatus.Scheduled) / card.Bouts.Count),
            // A race's laps say nothing without its length, which the game doesn't give.
            _ when league.Sport == Sport.Racing => 0.5,
            _ when game.Period is { } period => Math.Clamp((period - 0.5) / Math.Max(1, league.Regulation), 0.1, 1),
            _ => 0.5,
        };
    }

    private static int PlayedPeriods(League league, ProviderGame game) => game.Status == ProviderStatus.Final
        ? Math.Max(game.Period ?? league.Regulation, league.Regulation)
        : Math.Max(game.Period ?? 1, 1);

    private static List<GamePeriodScore> PeriodScores(League league, ProviderGame game, int periods)
    {
        if (league.Sport is not (Sport.Football or Sport.Basketball or Sport.Hockey or Sport.Baseball))
            return [];
        // In the top of an inning, the home side hasn't batted in it yet.
        var homeYetToBat = league.Sport == Sport.Baseball && game.Status != ProviderStatus.Final
            && game.Phase is ProviderPeriodPhase.InningTop or ProviderPeriodPhase.InningMiddle;
        return Enumerable.Range(1, Math.Max(periods, league.Regulation)).Select(period => new GamePeriodScore(
            GamePeriodScore.LabelFor(league, period),
            period > periods || (period == periods && homeYetToBat) ? null : PeriodPoints(league, game, "home", period),
            period > periods ? null : PeriodPoints(league, game, "away", period))).ToList();
    }

    private static string PeriodPoints(League league, ProviderGame game, string side, int period)
    {
        var random = Seeded(game.Id, $"{side} period {period}");
        var minutes = league.PeriodClockMinutes ?? 12;
        var points = league.Sport switch
        {
            Sport.Football => OneOf(random, 0, 0, 3, 7, 7, 10, 14, 3, 7, 0, 6, 17),
            Sport.Basketball => random.Next((int)(minutes * 1.4), (int)(minutes * 2.6)),
            Sport.Hockey => OneOf(random, 0, 0, 0, 1, 1, 1, 2, 2, 3),
            _ => OneOf(random, 0, 0, 0, 0, 0, 0, 1, 1, 2, 3),
        };
        return points.ToString(CultureInfo.InvariantCulture);
    }

    private static List<GameScoringPlay> Scoring(League league, ProviderGame game, int periods)
    {
        if (league.Sport == Sport.Tennis)
            return [];
        var sport = ScenarioSports.For(league);
        var sides = game.Sides();
        var plays = new List<(int Period, double Elapsed, bool Home, int Points, string Text, string? Clock, ProviderPeriodPhase Phase)>();
        foreach (var (team, home) in new[] { (sides.Home, true), (sides.Away, false) })
        {
            var remaining = team.Score ?? 0;
            var sizes = Seeded(game.Id, $"{team.Abbreviation} scoring");
            // Cricket's plays are its wickets, ten at most.
            var most = league.Sport == Sport.Cricket ? 10 : 100;
            for (var i = 0; remaining > 0 && i < most; i++)
            {
                var points = Math.Min(remaining, NextScore(league.Sport, sizes));
                remaining -= points;
                var random = Seeded(game.Id, $"{team.Abbreviation} score {i}");
                var period = ScoringPeriod(league, game, team, home, periods, random);
                var elapsed = random.NextDouble();
                if (period == periods && game.Status != ProviderStatus.Final && ElapsedNow(league, game) is { } now)
                    elapsed *= now;
                var text = PlayText(league.Sport, sport, points, random);
                var (clock, phase) = ScoringClock(league, period, elapsed, home, random);
                plays.Add((period, elapsed, home, points, text, clock, phase));
            }
        }

        var (homeRunning, awayRunning) = (0, 0);
        var scoring = new List<GameScoringPlay>();
        foreach (var play in plays.OrderBy(play => play.Period).ThenBy(play => play.Elapsed))
        {
            if (play.Home)
                homeRunning += play.Points;
            else
                awayRunning += play.Points;
            var team = play.Home ? sides.Home.Abbreviation : sides.Away.Abbreviation;
            var when = ClockLine.When(new ProviderScoringPlay(team, play.Text, play.Period, play.Clock, play.Phase), league);
            // Cricket's sides bat in turn, so a running score of both says nothing.
            var running = league.Sport != Sport.Cricket;
            scoring.Add(new GameScoringPlay(team, play.Text, when, running ? homeRunning : null, running ? awayRunning : null));
        }
        return scoring;
    }

    private static int NextScore(Sport sport, Random random) => sport switch
    {
        Sport.Football => OneOf(random, 7, 7, 7, 7, 3, 3, 3, 6, 8, 2),
        Sport.Basketball => OneOf(random, 2, 2, 2, 2, 3, 3, 1, 1),
        Sport.Baseball => OneOf(random, 1, 1, 1, 1, 2, 2, 3, 4),
        Sport.Rugby => OneOf(random, 7, 7, 5, 3, 3),
        Sport.Cricket => random.Next(5, 45),
        _ => 1,
    };

    private static int ScoringPeriod(League league, ProviderGame game, ProviderTeam team, bool home, int periods, Random random)
    {
        if (league.Sport == Sport.Cricket)
            return team.Innings?.Target is null ? 1 : 2;
        var last = periods;
        // A home side's runs come in the bottom of an inning, which the current one may not have reached.
        if (league.Sport == Sport.Baseball && home && game.Status != ProviderStatus.Final
            && game.Phase is ProviderPeriodPhase.InningTop or ProviderPeriodPhase.InningMiddle)
            last = Math.Max(1, periods - 1);
        return 1 + random.Next(last);
    }

    /// <summary>How far through the current period play is, from its clock; null when it can't tell.</summary>
    private static double? ElapsedNow(League league, ProviderGame game)
    {
        var clock = game.DisplayClock;
        if (string.IsNullOrEmpty(clock))
            return null;
        if (league.Sport is Sport.Soccer or Sport.Rugby)
        {
            var half = league.Sport == Sport.Soccer ? 45 : 40;
            return int.TryParse(clock.Split('\'', '+')[0], out var minute)
                ? Math.Clamp((minute - half * ((game.Period ?? 1) - 1)) / (double)half, 0, 1)
                : null;
        }
        if (league.PeriodClockMinutes is not { } minutes)
            return null;
        var parts = clock.Split(':');
        if (parts.Length != 2 || !int.TryParse(parts[0], out var left) || !double.TryParse(parts[1], CultureInfo.InvariantCulture, out var seconds))
            return null;
        return Math.Clamp(1 - (left * 60 + seconds) / (minutes * 60.0), 0, 1);
    }

    private static (string? Clock, ProviderPeriodPhase Phase) ScoringClock(League league, int period, double elapsed, bool home, Random random)
    {
        switch (league.Sport)
        {
            case Sport.Baseball:
                return (null, home ? ProviderPeriodPhase.InningBottom : ProviderPeriodPhase.InningTop);
            case Sport.Soccer or Sport.Rugby:
                var half = league.Sport == Sport.Soccer ? 45 : 40;
                return ($"{half * (Math.Min(period, 2) - 1) + 1 + (int)(elapsed * (half - 1))}'", ProviderPeriodPhase.Playing);
            case Sport.Cricket:
                return ($"{1 + (int)(elapsed * 19)}.{random.Next(6)} ov", ProviderPeriodPhase.Playing);
            default:
                var left = (int)Math.Round((1 - elapsed) * (league.PeriodClockMinutes ?? 15) * 60);
                return ($"{left / 60}:{left % 60:00}", ProviderPeriodPhase.Playing);
        }
    }

    private static string PlayText(Sport sport, SportScenario scenario, int points, Random random) => sport switch
    {
        Sport.Soccer => $"{Player(random)} Goal - {Pick(random, "Right Footed Shot", "Left Footed Shot", "Header", "Penalty")}, assisted by {Player(random)}",
        Sport.Rugby => points switch
        {
            7 => $"{Player(random)} Try, {Player(random)} Conversion",
            5 => $"{Player(random)} Try",
            _ => $"{Player(random)} Penalty Goal",
        },
        Sport.Cricket => $"{Player(random)} c {Player(random)} b {Player(random)} {points}",
        _ => scenario.ScoringPlayText(points, random) ?? $"{Player(random)} scores",
    };

    private static List<GameDrive> Drives(ProviderGame game, double progress)
    {
        var sides = game.Sides();
        var count = Math.Max(1, (int)Math.Round(progress * 22));
        var homeFirst = Seeded(game.Id, "first drive").Next(2) == 0;
        var drives = new List<GameDrive>();
        for (var i = 0; i < count; i++)
        {
            var (offense, defense) = (i % 2 == 0) == homeFirst ? (sides.Home, sides.Away) : (sides.Away, sides.Home);
            var random = Seeded(game.Id, $"drive {i}");
            var under = i == count - 1 && game.Status != ProviderStatus.Final;
            var outcome = under ? null : Pick(random,
                "Touchdown", "Touchdown", "Field Goal", "Punt", "Punt", "Punt", "Interception", "Fumble", "Downs", "Missed FG");
            // Yard lines from the offense's own goal line, 0 to 100.
            var start = random.Next(10, 46);
            var end = outcome switch
            {
                "Touchdown" => 100 - random.Next(1, 10),
                "Field Goal" or "Missed FG" => random.Next(Math.Max(start, 55), 86),
                "Punt" => start + random.Next(0, 30),
                _ => start + random.Next(0, 45),
            };
            var plays = random.Next(3, 8) + (end - start) / 10;
            var seconds = plays * random.Next(20, 40);
            drives.Add(new GameDrive(offense.Abbreviation, outcome, outcome is "Touchdown" or "Field Goal", plays, end - start,
                $"{seconds / 60}:{seconds % 60:00}", YardLine(offense, defense, start), YardLine(offense, defense, end)));
        }
        return drives;
    }

    private static string YardLine(ProviderTeam offense, ProviderTeam defense, int yards) =>
        yards <= 50 ? $"{offense.Abbreviation} {yards}" : $"{defense.Abbreviation} {100 - yards}";

    private enum Shape
    {
        /// <summary>A count that grows through the game.</summary>
        Count,

        /// <summary>Made of attempted ("7/12"), growing through the game; "-" between them unless the label has "/".</summary>
        Made,

        /// <summary>A rate with one decimal ("142.5"), not growing.</summary>
        Rate,

        Percent,

        /// <summary>A rate to three decimals, written as ESPN writes a save percentage (".912").</summary>
        Fraction,
    }

    private sealed record Column(string Label, double Min, double Max, Shape Shape = Shape.Count);

    private sealed record Section(string Name, int Players, params Column[] Columns);

    private static Section[] Sections(Sport sport) => sport switch
    {
        Sport.Football =>
        [
            new("Passing", 1, new("C/ATT", 18, 42, Shape.Made), new("YDS", 120, 380), new("TD", 0, 4), new("INT", 0, 2)),
            new("Rushing", 3, new("CAR", 3, 22), new("YDS", 5, 130), new("TD", 0, 2)),
            new("Receiving", 4, new("REC", 1, 9), new("YDS", 8, 140), new("TD", 0, 2)),
        ],
        Sport.Basketball =>
        [
            new("Starters", 5, new("MIN", 22, 38), new("PTS", 4, 32), new("REB", 1, 12), new("AST", 0, 10), new("FG", 4, 20, Shape.Made)),
            new("Bench", 4, new("MIN", 6, 22), new("PTS", 0, 14), new("REB", 0, 6), new("AST", 0, 4), new("FG", 1, 8, Shape.Made)),
        ],
        Sport.Baseball =>
        [
            new("Batting", 9, new("AB", 3, 5), new("R", 0, 2), new("H", 0, 2.9), new("RBI", 0, 3), new("BB", 0, 2), new("K", 0, 3)),
            new("Pitching", 3, new("IP", 1, 7), new("H", 0, 8), new("ER", 0, 5), new("BB", 0, 4), new("K", 0, 10)),
        ],
        Sport.Hockey =>
        [
            new("Skaters", 6, new("G", 0, 2), new("A", 0, 2), new("SOG", 0, 6), new("HIT", 0, 5), new("TOI", 12, 24)),
            new("Goalies", 1, new("SA", 18, 40), new("GA", 0, 4), new("SV%", 0.88, 0.95, Shape.Fraction)),
        ],
        Sport.Soccer =>
        [
            new("Players", 6, new("G", 0, 1.4), new("A", 0, 1.4), new("ST/SH", 0, 5, Shape.Made), new("FC", 0, 3)),
            new("Goalkeeper", 1, new("SV", 0, 7), new("GA", 0, 3)),
        ],
        Sport.Rugby =>
        [
            new("Players", 7, new("T", 0, 1.4), new("CAR", 2, 18), new("MET", 5, 110), new("TKL", 2, 15), new("MT", 0, 4)),
        ],
        Sport.Cricket =>
        [
            new("Batting", 6, new("R", 0, 75), new("B", 2, 55), new("4s", 0, 7), new("6s", 0, 4), new("SR", 80, 190, Shape.Rate)),
            new("Bowling", 4, new("O", 1, 4), new("R", 12, 48), new("W", 0, 3), new("ECON", 6, 11, Shape.Rate)),
        ],
        Sport.Tennis =>
        [
            new("Serve", 1, new("ACES", 0, 14), new("DF", 0, 6), new("1ST%", 55, 75, Shape.Percent), new("BP WON", 0, 5)),
        ],
        _ => [],
    };

    private static GameStatTeam TeamStats(League league, ProviderGame game, ProviderTeam team, double progress)
    {
        var sections = Sections(league.Sport);
        // A tennis side is its player; any other side's players are the same in each of its games.
        var roster = league.Sport == Sport.Tennis ? [team.FullName] : Roster(league, team.FullName, sections.Sum(section => section.Players));
        var next = 0;
        return new GameStatTeam(team.Abbreviation, sections.Select(section =>
        {
            var players = roster.Skip(next).Take(section.Players).Select(name => new GameStatPlayer(name,
                section.Columns.Select(column => Value(column, Seeded(game.Id, $"{team.Abbreviation} {section.Name} {name} {column.Label}"), progress))
                    .ToList())).ToList();
            next += section.Players;
            return new GameStatSection(section.Name, section.Columns.Select(column => column.Label).ToList(), players);
        }).ToList());
    }

    private static List<string> Roster(League league, string team, int count)
    {
        var random = Seeded(league.Key, $"{team} roster");
        var names = new List<string>();
        while (names.Count < count)
        {
            var name = Player(random);
            if (!names.Contains(name))
                names.Add(name);
        }
        return names;
    }

    private static string Value(Column column, Random random, double progress)
    {
        var value = column.Min + random.NextDouble() * (column.Max - column.Min);
        switch (column.Shape)
        {
            case Shape.Made:
                var attempted = (int)Math.Round(value * progress);
                var made = (int)Math.Round(attempted * (0.4 + random.NextDouble() * 0.35));
                return $"{made}{(column.Label.Contains('/') ? "/" : "-")}{attempted}";
            case Shape.Rate:
                return value.ToString("0.0", CultureInfo.InvariantCulture);
            case Shape.Percent:
                return $"{(int)value}%";
            case Shape.Fraction:
                return value.ToString(".000", CultureInfo.InvariantCulture);
            default:
                return ((int)Math.Round(value * progress)).ToString(CultureInfo.InvariantCulture);
        }
    }

    /// <summary>A golf leaderboard's rounds, or a race's laps, laps led and pit stops, for the field's front.</summary>
    private static GameStatSection FieldStats(League league, ProviderGame game, ProviderField field)
    {
        var front = field.Entries.Take(league.Sport == Sport.Golf ? 10 : 12).ToList();
        if (league.Sport == Sport.Golf)
        {
            var rounds = game.Status == ProviderStatus.Final ? 4 : Math.Clamp(game.Period ?? 1, 1, 4);
            var columns = Enumerable.Range(1, rounds).Select(round => $"R{round}").Append("TOT").ToList();
            return new GameStatSection("Rounds", columns, front.Select(entrant =>
            {
                var strokes = Enumerable.Range(1, rounds).Select(round =>
                {
                    var full = Seeded(game.Id, $"{entrant.Name} round {round}").Next(64, 77);
                    // The round under way counts the holes played of it.
                    var holes = round < rounds || game.Status == ProviderStatus.Final ? 18 : entrant.Thru ?? 18;
                    return (int)Math.Round(full * holes / 18.0);
                }).ToList();
                return new GameStatPlayer(entrant.Name, [.. strokes.Select(Text), Text(strokes.Sum())]);
            }).ToList());
        }

        var laps = game.Period ?? 0;
        return new GameStatSection("Running order", ["LAPS", "LED", "PITS"], front.Select((entrant, index) =>
        {
            var random = Seeded(game.Id, $"{entrant.Name} race");
            var completed = Math.Max(0, laps - (index == 0 ? 0 : random.Next(0, 3)));
            var led = (int)Math.Round(random.NextDouble() * Math.Min(completed, 40) / (index + 1));
            var pits = laps == 0 ? 0 : random.Next(0, 5);
            return new GameStatPlayer(entrant.Name, [Text(completed), Text(led), Text(pits)]);
        }).ToList());
    }

    /// <summary>Each bout's strikes and takedowns so far, from the card's opener up to the bout on now.</summary>
    private static List<GameStatSection> BoutStats(ProviderGame game, ProviderBouts card)
    {
        Column[] columns = [new("SIG STR", 5, 90), new("TD", 0, 4), new("KD", 0, 1.4), new("SUB", 0, 2)];
        return card.Bouts.Where(bout => bout.Status != ProviderStatus.Scheduled).Reverse().Select(bout =>
        {
            var progress = bout.Status == ProviderStatus.Final
                ? 1
                : Math.Clamp(((bout.Round ?? 1) - 0.5) / Math.Max(1, bout.ScheduledRounds), 0.1, 1);
            return new GameStatSection($"{bout.First.Name} vs. {bout.Second.Name}", columns.Select(column => column.Label).ToList(),
                new[] { bout.First, bout.Second }.Select(fighter => new GameStatPlayer(fighter.Name, columns.Select(column =>
                    Value(column, Seeded(game.Id, $"{bout.Id} {fighter.Name} {column.Label}"), progress)).ToList())).ToList());
        }).DistinctBy(section => section.Name).ToList();
    }

    private static List<GameVideo> Videos(League league, ProviderGame game, double progress)
    {
        var random = Seeded(game.Id, "videos");
        var (who, star, rival) = game.Contest switch
        {
            ProviderSides sides when league.Sport == Sport.Tennis => ($"{sides.Away.FullName} vs. {sides.Home.FullName}",
                sides.Home.FullName, sides.Away.FullName),
            ProviderSides sides => ($"{sides.Away.FullName} vs. {sides.Home.FullName}",
                Roster(league, sides.Home.FullName, 1)[0], Roster(league, sides.Away.FullName, 1)[0]),
            ProviderField { Entries.Count: > 1 } field => (game.Note ?? league.Name, field.Entries[0].Name, field.Entries[1].Name),
            ProviderBouts { Bouts.Count: > 0 } card => ($"{card.Bouts[0].First.Name} vs. {card.Bouts[0].Second.Name}",
                card.Bouts[0].First.Name, card.Bouts[0].Second.Name),
            _ => (game.Note ?? league.Name, null, null),
        };
        var moment = random.Next(3);
        List<string> titles = progress == 0 ? [$"Preview: {who}"] :
        [
            $"Highlights: {who}",
            .. star is null ? Array.Empty<string>() : [$"{star} {Moment(league.Sport, moment)}"],
            .. rival is null ? Array.Empty<string>() : [$"{rival} {Moment(league.Sport, (moment + 1 + random.Next(2)) % 3)}"],
            $"Best plays: {who}",
            game.Status == ProviderStatus.Final ? $"Recap: {who}" : $"Inside the action: {who}",
        ];
        var count = progress == 0 ? 1 : Math.Min(titles.Count, 2 + (int)(progress * 3));
        return titles.Take(count).Select((title, index) =>
            new GameVideo(title, $"{VideoPage}#scenario-video-{index + 1}", random.Next(30, 241))).ToList();
    }

    /// <summary>One of three highlights in <paramref name="sport"/>, by <paramref name="which"/>, so two players' differ.</summary>
    private static string Moment(Sport sport, int which) => (sport switch
    {
        Sport.Football => new[] { "breaks free for a big gain", "makes a diving catch", "strips the ball loose" },
        Sport.Basketball => new[] { "throws down a huge dunk", "buries a deep three", "swats it away" },
        Sport.Baseball => new[] { "crushes a home run", "makes a diving stop", "strikes out the side" },
        Sport.Hockey => new[] { "buries a one-timer", "robs a sure goal", "dangles through the defense" },
        Sport.Soccer => new[] { "curls one into the top corner", "makes a stunning save", "slots home a penalty" },
        Sport.Rugby => new[] { "powers over for a try", "makes a try-saving tackle", "breaks the line" },
        Sport.Cricket => new[] { "smashes a six over long-on", "takes a stunning catch", "bowls a beauty" },
        Sport.Tennis => new[] { "fires a winner down the line", "saves a break point", "hits a stunning lob" },
        Sport.Golf => new[] { "drains a long birdie putt", "holes out from the bunker", "eagles the par 5" },
        Sport.Racing => new[] { "makes a bold pass for the lead", "pulls off a quick pit stop", "survives a near miss" },
        Sport.Mma => new[] { "lands a huge right hand", "locks in a tight choke", "scores a big takedown" },
        _ => ["makes a huge play", "makes a big play", "comes up big"],
    })[which];

    private static List<string> Broadcasts(League league, ProviderGame game)
    {
        var networks = league.Sport switch
        {
            Sport.Football => new[] { "ESPN", "ABC", "FOX", "CBS", "NBC", "ESPN2", "NFL Network" },
            Sport.Basketball => ["ESPN", "ABC", "TNT", "NBA TV", "ESPN2", "CBS"],
            Sport.Baseball => ["FOX", "FS1", "TBS", "ESPN", "MLB Network", "Apple TV"],
            Sport.Hockey => ["ESPN", "TNT", "NHL Network", "ESPN+", "Sportsnet"],
            Sport.Soccer => ["Peacock", "USA Network", "Paramount+", "FOX", "FS1", "Apple TV"],
            Sport.Cricket => ["Willow", "ESPN+"],
            Sport.Rugby => ["Peacock", "CNBC", "ESPN+"],
            Sport.Tennis => ["Tennis Channel", "ESPN", "ESPN2", "ESPN+"],
            Sport.Racing => ["FOX", "FS1", "NBC", "USA Network", "Prime Video"],
            Sport.Golf => ["CBS", "NBC", "Golf Channel", "ESPN+"],
            _ => ["ESPN+", "ESPN", "Paramount+"],
        };
        var random = Seeded(game.Id, "broadcasts");
        return networks.OrderBy(_ => random.Next()).Take(1 + random.Next(2)).ToList();
    }

    private static int OneOf(Random random, params int[] choices) => choices[random.Next(choices.Length)];

    private static string Text(int value) => value.ToString(CultureInfo.InvariantCulture);
}
