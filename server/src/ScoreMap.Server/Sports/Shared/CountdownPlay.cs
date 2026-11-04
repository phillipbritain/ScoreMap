using ScoreMap.Server.GameFeed;
using ScoreMap.Server.Games;
using ScoreMap.Server.Scenarios;

namespace ScoreMap.Server.Sports.Shared;

/// <summary>Countdown periods with weighted intermissions; the league supplies period count and minutes.</summary>
internal sealed class CountdownPlay(League league, PlayScoring scoring) : SegmentPlay(league, scoring, Segments(league.Regulation))
{
    protected override string PositionClock(PlaySegment segment, double done)
    {
        var left = TimeSpan.FromSeconds(Math.Floor((segment.Playing ? 1 - done : 0) * PeriodMinutes * 60));
        return $"{(int)left.TotalMinutes}:{left.Seconds:00}";
    }

    protected override double DoneAt(int period, string? clock) =>
        PeriodClock.TimeLeft(clock) is { } left
            ? Math.Clamp(1 - left.TotalSeconds / (PeriodMinutes * 60.0), 0, 1)
            : 0;

    private static List<PlaySegment> Segments(int regulation)
    {
        var segments = new List<PlaySegment>();
        for (var period = 1; period <= regulation; period++)
        {
            segments.Add(new(period, ProviderPeriodPhase.Playing, 1, true));
            if (period < regulation)
                segments.Add(new(period, ProviderPeriodPhase.Break, period * 2 == regulation ? 0.5 : 0.2, false));
        }
        return segments;
    }
}
