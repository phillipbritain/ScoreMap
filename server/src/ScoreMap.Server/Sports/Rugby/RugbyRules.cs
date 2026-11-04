using ScoreMap.Server.GameFeed;
using ScoreMap.Server.Games;

using ScoreMap.Server.Sports.Shared;

namespace ScoreMap.Server.Sports;

internal sealed class RugbyRules : SportRule
{
    internal static readonly RugbyRules Instance = new();
    internal override string Name => "Rugby";
    internal override SportUsual Usual { get; } = new(2, 40);

    protected override string? ClockInPlay(ProviderGame game, League league, int period) =>
        ClockFormat.Halves(game, period, league.Regulation);

    protected override bool HotSides(ProviderGame game, ProviderSides sides, int period, League league) =>
        Rugby(game, sides, period, league.Regulation);

    private static bool Rugby(ProviderGame game, ProviderSides sides, int period, int regulation)
    {
        if (game.Phase == ProviderPeriodPhase.Break || HotFinish.Margin(sides) is not (>= 0 and <= 7))
            return false;
        return period > regulation || (period == regulation && HotFinish.Minute(game.DisplayClock) >= 75);
    }
}
