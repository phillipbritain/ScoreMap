using ScoreMap.Server.GameFeed;
using ScoreMap.Server.Games;

using ScoreMap.Server.Sports.Shared;

namespace ScoreMap.Server.Sports;

internal sealed class RacingRules : SportRule
{
    internal static readonly RacingRules Instance = new();
    internal override string Name => "Racing";
    // The current lap is the period; a race has no regulation periods.
    internal override SportUsual Usual { get; } = new(1, null);

    protected override string? ClockInPlay(ProviderGame game, League league, int period) =>
        game.Status == ProviderStatus.Final ? "Final" : $"Lap {period}";

    protected override bool HotSides(ProviderGame game, ProviderSides sides, int period, League league) =>
        false;
}
