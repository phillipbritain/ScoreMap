using ScoreMap.Server.GameFeed;
using ScoreMap.Server.Games;

namespace ScoreMap.Server.Sports;

using ScoreMap.Server.Sports.Shared;

internal sealed class RacingRules : SportRule
{
    internal static readonly RacingRules Instance = new();
    internal override string Name => "Racing";
    internal override SportUsual Usual => new(1, null);

    protected override string? ClockInPlay(ProviderGame game, League league, int period) =>
        game.Status == ProviderStatus.Final ? "Final" : $"Lap {period}";

    protected override bool HotSides(ProviderGame game, ProviderSides sides, int period, League league) =>
        false;
}
