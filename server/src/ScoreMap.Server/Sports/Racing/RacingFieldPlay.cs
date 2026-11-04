using ScoreMap.Server.GameFeed;
using ScoreMap.Server.Games;
using ScoreMap.Server.Scenarios;
using ScoreMap.Server.Sports.Shared;

namespace ScoreMap.Server.Sports;

internal sealed class RacingFieldPlay : FieldPlay
{
    internal static readonly RacingFieldPlay Instance = new();
    private const int RaceLaps = 200;

    internal override double Through(ProviderField field, int period, ProviderPeriodPhase phase) =>
        (period - 1) / (double)RaceLaps;

    internal override ProviderField Reset(ProviderField field) =>
        ProviderField.TiedByScore(field.Entries.Select(e => e with { ToPar = null, Thru = null }));

    internal override (ProviderGame Game, double Through) Advance(
        ProviderGame game, ProviderField field, double before, double through, Random random)
    {
        var entries = field.Entries.ToList();
        var previousLap = (int)(before * RaceLaps);
        var lap = (int)(through * RaceLaps);
        if (lap != previousLap && entries.Count > 1 && random.NextDouble() < 0.4)
        {
            var index = random.Next(entries.Count - 1);
            (entries[index], entries[index + 1]) = (entries[index + 1], entries[index]);
        }
        return (game with { Period = Math.Min(RaceLaps, lap + 1), Contest = ProviderField.TiedByScore(entries),
            Phase = ProviderPeriodPhase.Playing, DisplayClock = null }, through);
    }
}
