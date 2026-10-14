using ScoreMap.Server.GameFeed;
using ScoreMap.Server.Games;

namespace ScoreMap.Server.Scenarios;

/// <summary>
/// How a game in a league plays out in a scenario, for every made-up game (fill's and random play's): the
/// stretches of play and the breaks it goes through from start to finish, with their periods and clock,
/// and how often and by how much a team scores, so a whole game ends at roughly the sport's usual margins.
/// How far through a game is runs from 0 (just started) to 1 (finished), across its planned length.
/// Cricket is played a ball at a time, to one side at once: the away team bats first, and the home team
/// chases its runs. A side all out ends its innings early, and a chase won (or all out) ends the game.
/// </summary>
internal sealed class SportPlay
{
    private readonly Sport _sport;
    private readonly double _plannedMinutes;
    private readonly IReadOnlyList<Segment> _segments;
    private readonly double _totalWeight;
    private readonly double _playingShare;
    private readonly Scoring _scoring;

    /// <summary>One stretch of a game: play, or a break, taking <paramref name="Weight"/> of its length relative to the others.</summary>
    private sealed record Segment(int Period, ProviderPeriodPhase Phase, double Weight, bool Playing);

    /// <summary>
    /// A team's scores in a whole game (<paramref name="PerGame"/>), the points each is worth with
    /// its chance, the most a team ever gets, and the score that settles a level game, if any.
    /// </summary>
    private sealed record Scoring(double PerGame, (int Points, double Chance)[] Points, int Most, int? Settling);

    public SportPlay(League league)
    {
        _sport = league.Sport;
        _plannedMinutes = league.PlannedLength.TotalMinutes;
        Regulation = league.Regulation;
        PeriodMinutes = league.PeriodClockMinutes ?? 0;
        _segments = Segments(league.Sport, Regulation);
        _totalWeight = _segments.Sum(s => s.Weight);
        _playingShare = _segments.Where(s => s.Playing).Sum(s => s.Weight) / _totalWeight;

        _scoring = league.Sport switch
        {
            Sport.Football => new Scoring(3.5, [(7, 0.7), (3, 0.3)], 47, 3),
            Sport.Basketball when Regulation == 2 => new Scoring(34, BasketballPoints, 100, 2),
            Sport.Basketball when PeriodMinutes == 10 => new Scoring(36, BasketballPoints, 115, 2),
            Sport.Basketball => new Scoring(52, BasketballPoints, 137, 2),
            Sport.Baseball => new Scoring(3, [(1, 0.65), (2, 0.25), (3, 0.08), (4, 0.02)], 11, 1),
            Sport.Hockey => new Scoring(3, [(1, 1.0)], 7, 1),
            _ => new Scoring(1.4, [(1, 1.0)], 6, null),
        };
    }

    private static readonly (int, double)[] BasketballPoints = [(1, 0.15), (2, 0.6), (3, 0.25)];

    /// <summary>The most overs a side faces in a cricket innings: the IPL's 20.</summary>
    private const int CricketOvers = 20;

    private const int BallsPerOver = 6;

    /// <summary>The chance a ball takes a wicket, so a side loses about 6 in its 20 overs.</summary>
    private const double WicketChance = 0.05;

    /// <summary>The runs off a ball that takes no wicket, with their chances: about 170 a side in 20 overs.</summary>
    private static readonly (int Points, double Chance)[] RunsOffABall = [(0, 0.35), (1, 0.38), (2, 0.08), (4, 0.12), (6, 0.07)];

    /// <summary>The periods in a game before overtime.</summary>
    public int Regulation { get; }

    /// <summary>
    /// How long a period lasts on the game clock (a half in soccer); not used in baseball or cricket, which
    /// have no clock.
    /// </summary>
    private int PeriodMinutes { get; }

    /// <summary>How long soccer's halftime lasts.</summary>
    private const int SoccerHalftimeMinutes = 15;

    /// <summary>A soccer clock: the minute of the game, such as <c>67'</c>.</summary>
    private static string SoccerClock(int minute) => $"{minute}'";

    /// <summary>A period's clock counting down, with <paramref name="left"/> to go, such as <c>8:05</c>.</summary>
    private static string Countdown(TimeSpan left) => $"{(int)left.TotalMinutes}:{left.Seconds:00}";

    /// <summary>Whether a game <paramref name="through"/> of the way through is being played (not on a break).</summary>
    public bool IsPlaying(double through) => SegmentAt(through).Segment.Playing;

    /// <summary>The teams as a game starts: level at 0, or in cricket the away team in to bat, the home team yet to.</summary>
    public (ProviderTeam Home, ProviderTeam Away) Start(ProviderTeam home, ProviderTeam away) =>
        _sport == Sport.Cricket
            ? (home with { Score = null, Innings = null }, InToBat(away, target: null))
            : (home with { Score = 0 }, away with { Score = 0 });

    /// <summary>
    /// The teams after a step of play that takes a game from <paramref name="through"/> a further
    /// <paramref name="step"/>: each may score, but never past the most a team gets in a game; in cricket,
    /// the balls due in the step are bowled.
    /// </summary>
    public (ProviderTeam Home, ProviderTeam Away) Step(ProviderTeam home, ProviderTeam away, double through, double step, Random random)
    {
        if (_sport == Sport.Cricket)
            return Bowl(home, away, through + step, random, mayFinish: true);
        if (!IsPlaying(through))
            return (home, away);
        return (home with { Score = ScoreStep(home.Score ?? 0, step, random) },
            away with { Score = ScoreStep(away.Score ?? 0, step, random) });
    }

    /// <summary>
    /// How far through a game is after a step of play took it to <paramref name="through"/>: there, except
    /// in cricket when an innings is over early, which takes the first innings on to the innings break,
    /// and the second to the end of the game.
    /// </summary>
    public double After(ProviderTeam home, ProviderTeam away, double through)
    {
        var (segment, _) = SegmentAt(through);
        if (_sport != Sport.Cricket || !segment.Playing)
            return through;
        var batting = segment.Period == 2 ? home : away;
        if (batting.Innings is not { } innings || !InningsOver(batting.Score ?? 0, innings.Wickets ?? 10, innings.Target))
            return through;
        return segment.Period == 2 ? 1 : Math.Max(through, Through(1, null, ProviderPeriodPhase.Break) ?? through);
    }

    /// <summary>
    /// The teams <paramref name="through"/> of the way through a game, played a minute of planned length
    /// at a time as random play plays it, and how far through it really is: in cricket, further if an
    /// innings ended early. With <paramref name="mayFinish"/> false, a cricket chase stays short of
    /// deciding the game, for a game made up as still under way.
    /// </summary>
    public (ProviderTeam Home, ProviderTeam Away, double Through) PlayTo(
        ProviderTeam home, ProviderTeam away, double through, Random random, bool mayFinish)
    {
        if (_sport != Sport.Cricket)
            return (home with { Score = ScoreAt(through, random) }, away with { Score = ScoreAt(through, random) }, through);

        (home, away) = Start(home, away);
        var step = 1 / _plannedMinutes;
        var at = 0.0;
        while (at < through)
        {
            var next = Math.Min(through, at + step);
            (home, away) = Bowl(home, away, next, random, mayFinish);
            at = After(home, away, next);
        }
        return (home, away, at);
    }

    /// <summary>
    /// The final score of a game that ends with these teams: in a sport without draws, a level game is
    /// settled by one more score, to either team.
    /// </summary>
    public (ProviderTeam Home, ProviderTeam Away) Settled(ProviderTeam home, ProviderTeam away, Random random)
    {
        var (homeScore, awayScore) = (home.Score ?? 0, away.Score ?? 0);
        if (_scoring.Settling is not { } settle || homeScore != awayScore)
            return (home with { Score = homeScore }, away with { Score = awayScore });
        return random.Next(2) == 0
            ? (home with { Score = homeScore + settle }, away with { Score = awayScore })
            : (home with { Score = homeScore }, away with { Score = awayScore + settle });
    }

    /// <summary>A team's score after a step of play: it may score, but never past the most a team gets in a game.</summary>
    private int ScoreStep(int score, double step, Random random)
    {
        if (random.NextDouble() >= _scoring.PerGame * step / _playingShare || score >= _scoring.Most)
            return score;
        return Math.Min(_scoring.Most, score + Pick(_scoring.Points, random));
    }

    /// <summary>
    /// A team's score <paramref name="through"/> of the way through a game: its play so far, scored a
    /// minute of planned length at a time as random play scores it.
    /// </summary>
    private int ScoreAt(double through, Random random)
    {
        var score = 0;
        var step = 1 / _plannedMinutes;
        for (var minute = 0; minute < through * _plannedMinutes; minute++)
        {
            if (IsPlaying(minute * step))
                score = ScoreStep(score, step, random);
        }
        return score;
    }

    /// <summary>
    /// Cricket: the balls due by <paramref name="to"/> of the way through the game, bowled to the side
    /// batting then, the away team in the first innings and the home team in the second, which comes in
    /// chasing one more than the away team's runs. Each ball takes a wicket or scores some runs, until the
    /// side is all out or has reached its target. With <paramref name="mayFinish"/> false, a ball that
    /// would decide the game goes for nothing.
    /// </summary>
    private (ProviderTeam Home, ProviderTeam Away) Bowl(ProviderTeam home, ProviderTeam away, double to, Random random, bool mayFinish)
    {
        var (segment, done) = SegmentAt(to);
        if (!segment.Playing)
            return (home, away);
        var chasing = segment.Period == 2;
        var batting = chasing ? home : away;
        if (batting.Innings is null)
        {
            batting = InToBat(batting, target: (away.Score ?? 0) + 1);
            // The side that batted first keeps its runs and wickets, not its overs.
            away = away with { Innings = (away.Innings ?? new(0)) with { Overs = null, OverLimit = null } };
        }

        var innings = batting.Innings!;
        var (runs, wickets, balls) = (batting.Score ?? 0, innings.Wickets ?? 10, Balls(innings.Overs));
        var due = Math.Min(CricketOvers * BallsPerOver, (int)(done * CricketOvers * BallsPerOver));
        for (; balls < due && !InningsOver(runs, wickets, innings.Target); balls++)
        {
            var (afterRuns, afterWickets) = random.NextDouble() < WicketChance
                ? (runs, wickets + 1)
                : (runs + Pick(RunsOffABall, random), wickets);
            if (!mayFinish && chasing && InningsOver(afterRuns, afterWickets, innings.Target))
                continue;
            (runs, wickets) = (afterRuns, afterWickets);
        }

        batting = batting with
        {
            Score = runs,
            Innings = innings with { Wickets = wickets < 10 ? wickets : null, Overs = Overs(balls) },
        };
        return chasing ? (batting, away) : (home, batting);
    }

    /// <summary>A cricket side coming in to bat, chasing <paramref name="target"/> in the second innings.</summary>
    private static ProviderTeam InToBat(ProviderTeam team, int? target) =>
        team with { Score = 0, Innings = new ProviderInnings(0, Overs(0), CricketOvers, target) };

    /// <summary>Whether a cricket innings is over before its overs are: the side all out, or at its target.</summary>
    private static bool InningsOver(int runs, int wickets, int? target) => wickets >= 10 || runs >= target;

    /// <summary>Overs as cricket writes them: "13.2" is 13 overs and 2 balls.</summary>
    private static string Overs(int balls) =>
        balls % BallsPerOver == 0 ? $"{balls / BallsPerOver}" : $"{balls / BallsPerOver}.{balls % BallsPerOver}";

    /// <summary>The balls in overs written as cricket writes them, such as "13.2"; none if they can't be read.</summary>
    private static int Balls(string? overs)
    {
        var parts = (overs ?? "").Split('.');
        return int.TryParse(parts[0], out var whole)
            ? whole * BallsPerOver + (parts.Length > 1 && int.TryParse(parts[1], out var part) ? part : 0)
            : 0;
    }

    /// <summary>One of <paramref name="choices"/>, by its chance.</summary>
    private static int Pick((int Points, double Chance)[] choices, Random random)
    {
        var roll = random.NextDouble();
        foreach (var (points, chance) in choices)
        {
            if (roll < chance)
                return points;
            roll -= chance;
        }
        return choices[^1].Points;
    }

    /// <summary>Where a game <paramref name="through"/> of the way through stands: its period, clock and phase.</summary>
    public (int Period, string? Clock, ProviderPeriodPhase Phase) Position(double through)
    {
        var (segment, done) = SegmentAt(through);
        string? clock = _sport switch
        {
            Sport.Baseball => null,
            // The overs bowled in the innings, which Through reads back; the clock line doesn't show it.
            Sport.Cricket => segment.Playing ? Overs((int)(done * CricketOvers * BallsPerOver)) : null,
            Sport.Soccer => SoccerClock(segment.Playing
                ? (segment.Period - 1) * PeriodMinutes + Math.Min(PeriodMinutes, (int)(done * PeriodMinutes) + 1)
                : segment.Period * PeriodMinutes),
            _ => Countdown(TimeSpan.FromSeconds(Math.Floor((segment.Playing ? 1 - done : 0) * PeriodMinutes * 60))),
        };
        return (segment.Period, clock, segment.Phase);
    }

    /// <summary>
    /// How far through a game is that stands at this period, clock and phase, as a scenario writes them
    /// out: the other way round from <see cref="Position"/>. A clock that can't be read counts as the
    /// start of its period (or break). Null for a period the game doesn't have, such as overtime.
    /// </summary>
    public double? Through(int period, string? clock, ProviderPeriodPhase phase)
    {
        var before = 0.0;
        foreach (var segment in _segments)
        {
            if (segment.Period == period && segment.Phase == phase)
                return (before + segment.Weight * (segment.Playing ? DoneAt(period, clock) : 0)) / _totalWeight;
            before += segment.Weight;
        }
        return null;
    }

    /// <summary>How far through a period of play its clock is, from 0 to 1.</summary>
    private double DoneAt(int period, string? clock)
    {
        switch (_sport)
        {
            case Sport.Baseball:
                return 0;
            case Sport.Cricket:
                return Math.Clamp(Balls(clock) / (double)(CricketOvers * BallsPerOver), 0, 1);
            case Sport.Soccer:
                // The minute of the game, such as 67' (or 90'+3, in added time): halfway through it, as
                // its very start could round down to the minute before.
                var digits = new string((clock ?? "").TakeWhile(char.IsAsciiDigit).ToArray());
                return int.TryParse(digits, out var minute)
                    ? Math.Clamp((minute - 0.5 - (period - 1) * PeriodMinutes) / PeriodMinutes, 0, 1)
                    : 0;
            default:
                // Time left in the period, counting down, such as 8:05.
                return PeriodClock.TimeLeft(clock) is { } left
                    ? Math.Clamp(1 - left.TotalSeconds / (PeriodMinutes * 60.0), 0, 1)
                    : 0;
        }
    }

    /// <summary>The segment a game <paramref name="through"/> of the way through is in, and how far through that segment.</summary>
    private (Segment Segment, double Done) SegmentAt(double through)
    {
        var at = Math.Clamp(through, 0, 1) * _totalWeight;
        foreach (var segment in _segments)
        {
            if (at < segment.Weight)
                return (segment, at / segment.Weight);
            at -= segment.Weight;
        }
        return (_segments[^1], 1);
    }

    private static List<Segment> Segments(Sport sport, int regulation)
    {
        var segments = new List<Segment>();
        switch (sport)
        {
            case Sport.Baseball:
                // Top and bottom of each inning, with a short break in the middle and at the end.
                for (var inning = 1; inning <= regulation; inning++)
                {
                    segments.Add(new(inning, ProviderPeriodPhase.InningTop, 1, true));
                    segments.Add(new(inning, ProviderPeriodPhase.InningMiddle, 0.1, false));
                    segments.Add(new(inning, ProviderPeriodPhase.InningBottom, 1, true));
                    if (inning < regulation)
                        segments.Add(new(inning, ProviderPeriodPhase.InningEnd, 0.1, false));
                }
                break;
            case Sport.Cricket:
                // Two innings, around an innings break of about a tenth of an innings.
                segments.Add(new(1, ProviderPeriodPhase.Playing, 1, true));
                segments.Add(new(1, ProviderPeriodPhase.Break, 0.1, false));
                segments.Add(new(2, ProviderPeriodPhase.Playing, 1, true));
                break;
            case Sport.Soccer:
                // Two 45-minute halves around a 15-minute halftime.
                for (var half = 1; half <= regulation; half++)
                {
                    segments.Add(new(half, ProviderPeriodPhase.Playing, 1, true));
                    if (half < regulation)
                        segments.Add(new(half, ProviderPeriodPhase.Break, SoccerHalftimeMinutes / 45.0, false));
                }
                break;
            default:
                // Timed periods, with a longer break at halftime than between the others.
                for (var period = 1; period <= regulation; period++)
                {
                    segments.Add(new(period, ProviderPeriodPhase.Playing, 1, true));
                    if (period < regulation)
                        segments.Add(new(period, ProviderPeriodPhase.Break, period * 2 == regulation ? 0.5 : 0.2, false));
                }
                break;
        }
        return segments;
    }
}
