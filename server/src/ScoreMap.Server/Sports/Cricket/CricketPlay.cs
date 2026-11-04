using ScoreMap.Server.GameFeed;
using ScoreMap.Server.Games;
using ScoreMap.Server.Scenarios;
using ScoreMap.Server.Sports.Shared;

namespace ScoreMap.Server.Sports;

internal sealed class CricketPlay(League league) : SegmentPlay(league,
    new PlayScoring(1.4, [(1, 1.0)], 6, null),
    [new(1, ProviderPeriodPhase.Playing, 1, true), new(1, ProviderPeriodPhase.Break, 0.1, false), new(2, ProviderPeriodPhase.Playing, 1, true)])
{
    private const int CricketOvers = 20;
    private const int BallsPerOver = 6;
    private const double WicketChance = 0.05;
    private static readonly (int Points, double Chance)[] RunsOffABall = [(0, 0.35), (1, 0.38), (2, 0.08), (4, 0.12), (6, 0.07)];

    public override (ProviderTeam Home, ProviderTeam Away) Start(ProviderTeam home, ProviderTeam away) =>
        (home with { Score = null, Innings = null }, InToBat(away, target: null));

    public override (ProviderTeam Home, ProviderTeam Away) Step(ProviderTeam home, ProviderTeam away, double through, double step, Random random) =>
        Bowl(home, away, through + step, random, mayFinish: true);

    public override double After(ProviderTeam home, ProviderTeam away, double through)
    {
        var (segment, _) = SegmentAt(through);
        if (!segment.Playing)
            return through;
        var batting = segment.Period == 2 ? home : away;
        if (batting.Innings is not { } innings || !InningsOver(batting.Score ?? 0, innings.Wickets ?? 10, innings.Target))
            return through;
        return segment.Period == 2 ? 1 : Math.Max(through, Through(1, null, ProviderPeriodPhase.Break) ?? through);
    }

    public override (ProviderTeam Home, ProviderTeam Away, double Through) PlayTo(
        ProviderTeam home, ProviderTeam away, double through, Random random, bool mayFinish)
    {
        (home, away) = Start(home, away);
        var step = 1 / PlannedMinutes;
        var at = 0.0;
        while (at < through)
        {
            var next = Math.Min(through, at + step);
            (home, away) = Bowl(home, away, next, random, mayFinish);
            at = After(home, away, next);
        }
        return (home, away, at);
    }

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

    private static ProviderTeam InToBat(ProviderTeam team, int? target) =>
        team with { Score = 0, Innings = new ProviderInnings(0, Overs(0), CricketOvers, target) };

    private static bool InningsOver(int runs, int wickets, int? target) => wickets >= 10 || runs >= target;

    private static string Overs(int balls) =>
        balls % BallsPerOver == 0 ? $"{balls / BallsPerOver}" : $"{balls / BallsPerOver}.{balls % BallsPerOver}";

    private static int Balls(string? overs)
    {
        var parts = (overs ?? "").Split('.');
        return int.TryParse(parts[0], out var whole)
            ? whole * BallsPerOver + (parts.Length > 1 && int.TryParse(parts[1], out var part) ? part : 0)
            : 0;
    }

    protected override string? PositionClock(PlaySegment segment, double done) =>
        segment.Playing ? Overs((int)(done * CricketOvers * BallsPerOver)) : null;
    protected override double DoneAt(int period, string? clock) =>
        Math.Clamp(Balls(clock) / (double)(CricketOvers * BallsPerOver), 0, 1);
}
