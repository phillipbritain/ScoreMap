using ScoreMap.Server.GameFeed;
using ScoreMap.Server.Games;

namespace ScoreMap.Server.Scenarios;

/// <summary>
/// How a game in a league plays out in a scenario, for every made-up game (fill's and random play's): the
/// stretches of play and the breaks it goes through from start to finish, with their periods and clock,
/// and how often and by how much a team scores, so a whole game ends at roughly the sport's usual margins.
/// How far through a game is runs from 0 (just started) to 1 (finished), across its planned length.
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
        Regulation = league.RegulationPeriods ?? league.Sport switch
        {
            Sport.Baseball => 9,
            Sport.Hockey => 3,
            Sport.Soccer => 2,
            _ => 4,
        };
        PeriodMinutes = league.Sport switch
        {
            Sport.AmericanFootball => 15,
            Sport.Basketball => Regulation == 2 ? 20 : 12,
            Sport.Soccer => 45,
            _ => 20,
        };
        _segments = Segments(league.Sport, Regulation);
        _totalWeight = _segments.Sum(s => s.Weight);
        _playingShare = _segments.Where(s => s.Playing).Sum(s => s.Weight) / _totalWeight;

        _scoring = league.Sport switch
        {
            Sport.AmericanFootball => new Scoring(3.5, [(7, 0.7), (3, 0.3)], 47, 3),
            Sport.Basketball when Regulation == 2 => new Scoring(34, BasketballPoints, 100, 2),
            Sport.Basketball => new Scoring(52, BasketballPoints, 137, 2),
            Sport.Baseball => new Scoring(3, [(1, 0.65), (2, 0.25), (3, 0.08), (4, 0.02)], 11, 1),
            Sport.Hockey => new Scoring(3, [(1, 1.0)], 7, 1),
            _ => new Scoring(1.4, [(1, 1.0)], 6, null),
        };
    }

    private static readonly (int, double)[] BasketballPoints = [(1, 0.15), (2, 0.6), (3, 0.25)];

    /// <summary>The periods in a game before overtime.</summary>
    public int Regulation { get; }

    /// <summary>
    /// How long a period lasts on the game clock (a half in soccer); not used in baseball, which has no
    /// clock.
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

    /// <summary>
    /// A team's score after a step of play that takes the game <paramref name="step"/> further through:
    /// it may score, but never past the most a team gets in a game.
    /// </summary>
    public int ScoreStep(int score, double step, Random random)
    {
        if (random.NextDouble() >= _scoring.PerGame * step / _playingShare || score >= _scoring.Most)
            return score;
        return Math.Min(_scoring.Most, score + Points(random));
    }

    /// <summary>
    /// A team's score <paramref name="through"/> of the way through a game: its play so far, scored a
    /// minute of planned length at a time as random play scores it.
    /// </summary>
    public int ScoreAt(double through, Random random)
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
    /// The final score of a game that ends <paramref name="home"/>-<paramref name="away"/>: in a sport
    /// without draws, a level game is settled by one more score, to either team.
    /// </summary>
    public (int Home, int Away) Settled(int home, int away, Random random)
    {
        if (_scoring.Settling is not { } settle || home != away)
            return (home, away);
        return random.Next(2) == 0 ? (home + settle, away) : (home, away + settle);
    }

    /// <summary>The points a score is worth.</summary>
    private int Points(Random random)
    {
        var roll = random.NextDouble();
        foreach (var (points, chance) in _scoring.Points)
        {
            if (roll < chance)
                return points;
            roll -= chance;
        }
        return _scoring.Points[^1].Points;
    }

    /// <summary>Where a game <paramref name="through"/> of the way through stands: its period, clock and phase.</summary>
    public (int Period, string? Clock, ProviderPeriodPhase Phase) Position(double through)
    {
        var (segment, done) = SegmentAt(through);
        string? clock = _sport switch
        {
            Sport.Baseball => null,
            Sport.Soccer => SoccerClock(segment.Playing
                ? (segment.Period - 1) * PeriodMinutes + Math.Min(PeriodMinutes, (int)(done * PeriodMinutes) + 1)
                : segment.Period * PeriodMinutes),
            _ => Countdown(TimeSpan.FromSeconds(Math.Floor((segment.Playing ? 1 - done : 0) * PeriodMinutes * 60))),
        };
        return (segment.Period, clock, segment.Phase);
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
