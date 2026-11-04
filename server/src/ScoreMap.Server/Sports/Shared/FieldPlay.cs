using ScoreMap.Server.GameFeed;
using ScoreMap.Server.Games;
using ScoreMap.Server.Scenarios;

namespace ScoreMap.Server.Sports.Shared;

/// <summary>Progression and reset of an explicitly selected field style, using the caller's random stream.</summary>
internal abstract class FieldPlay
{
    internal abstract double Through(ProviderField field, int period, ProviderPeriodPhase phase);
    internal abstract ProviderField Reset(ProviderField field);
    internal abstract (ProviderGame Game, double Through) Advance(
        ProviderGame game, ProviderField field, double before, double through, Random random);
}
