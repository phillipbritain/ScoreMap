using ScoreMap.Server.GameFeed;
using ScoreMap.Server.Games;
using ScoreMap.Server.Scenarios;
using ScoreMap.Server.Sports.Shared;

namespace ScoreMap.Server.Sports;

internal sealed class GolfFieldPlay : FieldPlay
{
    internal static readonly GolfFieldPlay Instance = new();

    protected override double Through(ProviderField field, int period, ProviderPeriodPhase phase) =>
        (period - 1 + (phase == ProviderPeriodPhase.Break ? 0.5 : (field.Entries.FirstOrDefault()?.Thru ?? 0) / 36.0)) / 4;

    internal override ProviderField Reset(ProviderField field) =>
        ProviderField.TiedByScore(field.Entries.Select(e => e with { ToPar = 0, Thru = 0 }));

    protected override (ProviderGame Game, double Through) Advance(
        ProviderGame game, ProviderField field, double before, double through, Random random)
    {
        var entries = field.Entries.ToList();
        // Each day is half play, half night; the last day finishes at its last hole.
        var day = Math.Min(3, (int)(through * 4));
        var within = through * 4 - day;
        var holes = Math.Min(18, (int)(within * 36));
        var oldDay = Math.Min(3, (int)(before * 4));
        var oldHoles = Math.Min(18, (int)((before * 4 - oldDay) * 36));
        if (holes != oldHoles || day != oldDay)
            entries = entries.Select(e => e with { ToPar = (e.ToPar ?? 0) + random.Next(-1, 2), Thru = holes }).ToList();
        entries = entries.OrderBy(e => e.ToPar).ToList();
        var phase = holes == 18 && day < 3 ? ProviderPeriodPhase.Break : ProviderPeriodPhase.Playing;
        if (through >= 0.875)
            through = 1;
        return (game with { Period = day + 1, Contest = ProviderField.TiedByScore(entries), Phase = phase, DisplayClock = null }, through);
    }
}
