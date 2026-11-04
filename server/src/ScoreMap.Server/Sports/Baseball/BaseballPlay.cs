using ScoreMap.Server.GameFeed;
using ScoreMap.Server.Games;
using ScoreMap.Server.Scenarios;
using ScoreMap.Server.Sports.Shared;

namespace ScoreMap.Server.Sports;

internal sealed class BaseballPlay(League league, PlayScoring scoring) : SegmentPlay(league, scoring, Segments(league.Regulation))
{
    protected override string? PositionClock(PlaySegment segment, double done) => null;
    protected override double DoneAt(int period, string? clock) => 0;

    private static List<PlaySegment> Segments(int regulation)
    {
        var segments = new List<PlaySegment>();
        for (var inning = 1; inning <= regulation; inning++)
        {
            segments.Add(new(inning, ProviderPeriodPhase.InningTop, 1, true));
            segments.Add(new(inning, ProviderPeriodPhase.InningMiddle, 0.1, false));
            segments.Add(new(inning, ProviderPeriodPhase.InningBottom, 1, true));
            if (inning < regulation)
                segments.Add(new(inning, ProviderPeriodPhase.InningEnd, 0.1, false));
        }
        return segments;
    }
}
