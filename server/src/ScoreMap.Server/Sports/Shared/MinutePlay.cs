using ScoreMap.Server.GameFeed;
using ScoreMap.Server.Games;
using ScoreMap.Server.Scenarios;

namespace ScoreMap.Server.Sports.Shared;

/// <summary>Count-up halves around a fifteen-minute intermission.</summary>
internal sealed class MinutePlay(League league, PlayScoring scoring) : SegmentPlay(league, scoring, Segments(league))
{
    protected override string PositionClock(PlaySegment segment, double done) => $"{(segment.Playing
        ? (segment.Period - 1) * PeriodMinutes + Math.Min(PeriodMinutes, (int)(done * PeriodMinutes) + 1)
        : segment.Period * PeriodMinutes)}'";

    protected override double DoneAt(int period, string? clock)
    {
        var digits = new string((clock ?? "").TakeWhile(char.IsAsciiDigit).ToArray());
        return int.TryParse(digits, out var minute)
            ? Math.Clamp((minute - 0.5 - (period - 1) * PeriodMinutes) / PeriodMinutes, 0, 1)
            : 0;
    }

    private static List<PlaySegment> Segments(League league)
    {
        var segments = new List<PlaySegment>();
        for (var half = 1; half <= league.Regulation; half++)
        {
            segments.Add(new(half, ProviderPeriodPhase.Playing, 1, true));
            if (half < league.Regulation)
                segments.Add(new(half, ProviderPeriodPhase.Break, 15 / (double)(league.PeriodClockMinutes ?? 0), false));
        }
        return segments;
    }
}
