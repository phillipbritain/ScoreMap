using ScoreMap.Server.GameFeed;
using ScoreMap.Server.Sports.Shared;

namespace ScoreMap.Server.Scenarios;

/// <summary>
/// Play for a team sport's two sides: scores that go up as it plays, a period, clock and phase from how
/// far through it is, and a settled score at its end. A sport supplies the parts.
/// </summary>
internal abstract class SportPlay : SidesPlay
{
    protected abstract int Regulation { get; }
    protected abstract (ProviderTeam Home, ProviderTeam Away) StartScores(ProviderTeam home, ProviderTeam away);
    protected abstract (ProviderTeam Home, ProviderTeam Away) StepScores(ProviderTeam home, ProviderTeam away, double through, double step, Random random);
    protected abstract double After(ProviderTeam home, ProviderTeam away, double through);
    protected abstract (ProviderTeam Home, ProviderTeam Away, double Through) PlayTo(
        ProviderTeam home, ProviderTeam away, double through, Random random, bool mayFinish);
    protected abstract (ProviderTeam Home, ProviderTeam Away) Settled(ProviderTeam home, ProviderTeam away, Random random);
    protected abstract (int Period, string? Clock, ProviderPeriodPhase Phase) Position(double through);
    protected abstract double? Through(int period, string? clock, ProviderPeriodPhase phase);

    internal sealed override Played TakeOn(ProviderGame game, double sinceStart)
    {
        var written = game.Period is { } period ? Through(period, game.DisplayClock, game.Phase) : null;
        var through = Math.Clamp(written ?? sinceStart, 0, 1);
        return new(Positioned(game, through), through);
    }

    internal sealed override Played Start(ProviderGame game, double step, Random random)
    {
        var sides = game.Sides();
        var (home, away) = StartScores(sides.Home, sides.Away);
        return new(Positioned(game with { Status = ProviderStatus.InProgress, Contest = new ProviderSides(home, away) }, 0), 0);
    }

    /// <summary>It may score, then its clock moves on, perhaps to a break or the end (in cricket, sooner when an innings is over early).</summary>
    internal sealed override Played Step(ProviderGame game, double through, double step, Random random)
    {
        var sides = game.Sides();
        var (home, away) = StepScores(sides.Home, sides.Away, through, step, random);
        through = After(home, away, through + step);
        if (through < 1)
            return new(Positioned(game with { Contest = new ProviderSides(home, away) }, through), through);

        (home, away) = Settled(home, away, random);
        return new(game with
        {
            Contest = new ProviderSides(home, away),
            Status = ProviderStatus.Final,
            Period = Regulation,
            Phase = ProviderPeriodPhase.Playing,
        }, through);
    }

    /// <summary>Standing where its sport would be that far through (in cricket, perhaps further, past an innings over early); never finished.</summary>
    internal sealed override MadeUp Live(ProviderTeam home, ProviderTeam away, double through, Random random)
    {
        (home, away, through) = PlayTo(home, away, through, random, mayFinish: false);
        var (period, clock, phase) = Position(through);
        return new(home, away, period, clock, phase);
    }

    internal sealed override MadeUp Final(ProviderTeam home, ProviderTeam away, Random random)
    {
        (home, away, _) = PlayTo(home, away, 1, random, mayFinish: true);
        (home, away) = Settled(home, away, random);
        return new(home, away, Regulation, null, ProviderPeriodPhase.Playing);
    }

    private ProviderGame Positioned(ProviderGame game, double through)
    {
        var (period, clock, phase) = Position(through);
        return game with { Period = period, DisplayClock = clock, Phase = phase };
    }
}
