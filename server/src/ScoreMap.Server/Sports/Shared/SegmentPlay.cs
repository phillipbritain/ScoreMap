using ScoreMap.Server.GameFeed;
using ScoreMap.Server.Games;
using ScoreMap.Server.Scenarios;

namespace ScoreMap.Server.Sports.Shared;

/// <summary>Shared weighted progression and scoring; clocks and specialist play stay behind this interface.</summary>
internal abstract class SegmentPlay : SportPlay
{
    protected readonly double PlannedMinutes;
    private readonly IReadOnlyList<PlaySegment> _segments;
    private readonly double _totalWeight;
    private readonly double _playingShare;
    private readonly PlayScoring _scoring;

    protected SegmentPlay(League league, PlayScoring scoring, IReadOnlyList<PlaySegment> segments)
    {
        PlannedMinutes = league.PlannedLength.TotalMinutes;
        Regulation = league.Regulation;
        PeriodMinutes = league.PeriodClockMinutes ?? 0;
        _segments = segments;
        _totalWeight = _segments.Sum(s => s.Weight);
        _playingShare = _segments.Where(s => s.Playing).Sum(s => s.Weight) / _totalWeight;
        _scoring = scoring;
    }

    public override int Regulation { get; }
    protected int PeriodMinutes { get; }
    public override bool IsPlaying(double through) => SegmentAt(through).Segment.Playing;
    public override (ProviderTeam Home, ProviderTeam Away) Start(ProviderTeam home, ProviderTeam away) =>
        (home with { Score = 0 }, away with { Score = 0 });

    public override (ProviderTeam Home, ProviderTeam Away) Step(ProviderTeam home, ProviderTeam away, double through, double step, Random random)
    {
        if (!IsPlaying(through))
            return (home, away);
        return (home with { Score = ScoreStep(home.Score ?? 0, step, random) },
            away with { Score = ScoreStep(away.Score ?? 0, step, random) });
    }

    public override double After(ProviderTeam home, ProviderTeam away, double through) => through;

    public override (ProviderTeam Home, ProviderTeam Away, double Through) PlayTo(
        ProviderTeam home, ProviderTeam away, double through, Random random, bool mayFinish) =>
        (home with { Score = ScoreAt(through, random) }, away with { Score = ScoreAt(through, random) }, through);

    public override (ProviderTeam Home, ProviderTeam Away) Settled(ProviderTeam home, ProviderTeam away, Random random)
    {
        var (homeScore, awayScore) = (home.Score ?? 0, away.Score ?? 0);
        if (_scoring.Settling is not { } settle || homeScore != awayScore)
            return (home with { Score = homeScore }, away with { Score = awayScore });
        return random.Next(2) == 0
            ? (home with { Score = homeScore + settle }, away with { Score = awayScore })
            : (home with { Score = homeScore }, away with { Score = awayScore + settle });
    }

    private int ScoreStep(int score, double step, Random random)
    {
        if (random.NextDouble() >= _scoring.PerGame * step / _playingShare || score >= _scoring.Most)
            return score;
        return Math.Min(_scoring.Most, score + Pick(_scoring.Points, random));
    }

    private int ScoreAt(double through, Random random)
    {
        var score = 0;
        var step = 1 / PlannedMinutes;
        for (var minute = 0; minute < through * PlannedMinutes; minute++)
        {
            if (IsPlaying(minute * step))
                score = ScoreStep(score, step, random);
        }
        return score;
    }

    protected static int Pick((int Points, double Chance)[] choices, Random random)
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

    public override double? Through(int period, string? clock, ProviderPeriodPhase phase)
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

    protected (PlaySegment Segment, double Done) SegmentAt(double through)
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

    public override (int Period, string? Clock, ProviderPeriodPhase Phase) Position(double through)
    {
        var (segment, done) = SegmentAt(through);
        return (segment.Period, PositionClock(segment, done), segment.Phase);
    }

    protected abstract string? PositionClock(PlaySegment segment, double done);
    protected abstract double DoneAt(int period, string? clock);
}
