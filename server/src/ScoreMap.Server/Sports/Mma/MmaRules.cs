using ScoreMap.Server.GameFeed;
using ScoreMap.Server.Games;

namespace ScoreMap.Server.Sports;

using ScoreMap.Server.Sports.Shared;

internal sealed class MmaRules : SportRule
{
    internal static readonly MmaRules Instance = new();
    internal override string Name => "MMA";
    internal override SportUsual Usual => new(3, 5);

    protected override string? ClockInPlay(ProviderGame game, League league, int period) =>
        throw new ArgumentOutOfRangeException(nameof(league), league.Sport, "No clock line for this sport");

    protected override bool HotSides(ProviderGame game, ProviderSides sides, int period, League league) =>
        false;

    internal static string? FightCard(ProviderGame game, ProviderBouts card) => game.Status switch
    {
        ProviderStatus.InProgress or ProviderStatus.Delayed => card.OnNow?.Round is { } round ? $"R{round}" : "Between bouts",
        ProviderStatus.Final => card.Bouts.FirstOrDefault() is { Method: { } method } main
            ? method == BoutMethod.Decision || main.Round is null ? MethodName(method) : $"{MethodName(method)} · R{main.Round}"
            : "Final",
        _ => null,
    };

    internal static string? MethodName(BoutMethod? method) => method switch
    {
        BoutMethod.KnockOut => "KO/TKO",
        BoutMethod.Submission => "Submission",
        BoutMethod.Decision => "Decision",
        _ => null,
    };

    internal static bool HotCard(ProviderBouts card) =>
        card.Bouts.FirstOrDefault() is { } main && card.OnNow == main && main.Round == main.ScheduledRounds;
}
