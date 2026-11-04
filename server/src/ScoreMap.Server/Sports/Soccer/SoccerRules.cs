using ScoreMap.Server.GameFeed;
using ScoreMap.Server.Games;

namespace ScoreMap.Server.Sports;

using ScoreMap.Server.Sports.Shared;

internal sealed class SoccerRules : SportRule
{
    internal static readonly SoccerRules Instance = new();
    internal override string Name => "Soccer";
    internal override SportUsual Usual => new(2, 45);

    protected override string? ClockInPlay(ProviderGame game, League league, int period) =>
        ClockFormat.Halves(game, period, league.Regulation);

    protected override bool HotSides(ProviderGame game, ProviderSides sides, int period, League league) =>
        Soccer(game, sides, period, league.Regulation);

    private static bool Soccer(ProviderGame game, ProviderSides sides, int period, int regulation)
    {
        if (game.Phase == ProviderPeriodPhase.Shootout)
            return true;
        if (HotFinish.Margin(sides) is not (0 or 1) || HotFinish.Minute(game.DisplayClock) is not { } minute)
            return false;
        return period == regulation ? minute >= 85 : period > regulation && minute >= 115;
    }
}
