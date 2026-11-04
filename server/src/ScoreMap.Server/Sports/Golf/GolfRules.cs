using ScoreMap.Server.GameFeed;
using ScoreMap.Server.Games;

namespace ScoreMap.Server.Sports;

using ScoreMap.Server.Sports.Shared;

internal sealed class GolfRules : SportRule
{
    internal static readonly GolfRules Instance = new();
    internal override string Name => "Golf";
    internal override SportUsual Usual => new(4, null);

    protected override string? ClockInPlay(ProviderGame game, League league, int period) =>
        Rounds(game, period);

    protected override bool HotSides(ProviderGame game, ProviderSides sides, int period, League league) =>
        false;

    private static string Rounds(ProviderGame game, int round)
    {
        if (game.Status == ProviderStatus.Final)
            return "Final";
        if (game.Phase == ProviderPeriodPhase.Break)
            return $"After R{round}";
        return game.Contest is ProviderField { Entries: [{ Thru: > 0 and var thru }, ..] }
            ? $"R{round} · Thru {thru}"
            : $"R{round}";
    }

    private static bool Golf(ProviderGame game, ProviderField field, int round, int regulation) =>
        round >= regulation && game.Phase != ProviderPeriodPhase.Break
        && field.Entries is [{ Thru: >= 9, ToPar: { } leader }, { ToPar: { } second }, ..]
        && second - leader <= 1;

    protected override bool HotField(ProviderGame game, ProviderField field, int period, League league) =>
        Golf(game, field, period, league.Regulation);
}
