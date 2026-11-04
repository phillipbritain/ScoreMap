using ScoreMap.Server.GameFeed;

namespace ScoreMap.Server.Scenarios;

/// <summary>League-bound scenario play: positioning, incremental scores and complete made-up games.</summary>
internal abstract class SportPlay
{
    public abstract int Regulation { get; }
    public abstract bool IsPlaying(double through);
    public abstract (ProviderTeam Home, ProviderTeam Away) Start(ProviderTeam home, ProviderTeam away);
    public abstract (ProviderTeam Home, ProviderTeam Away) Step(ProviderTeam home, ProviderTeam away, double through, double step, Random random);
    public abstract double After(ProviderTeam home, ProviderTeam away, double through);
    public abstract (ProviderTeam Home, ProviderTeam Away, double Through) PlayTo(
        ProviderTeam home, ProviderTeam away, double through, Random random, bool mayFinish);
    public abstract (ProviderTeam Home, ProviderTeam Away) Settled(ProviderTeam home, ProviderTeam away, Random random);
    public abstract (int Period, string? Clock, ProviderPeriodPhase Phase) Position(double through);
    public abstract double? Through(int period, string? clock, ProviderPeriodPhase phase);
}
