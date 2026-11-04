using ScoreMap.Server.GameFeed;
using ScoreMap.Server.Games;

using ScoreMap.Server.Sports.Shared;

namespace ScoreMap.Server.Sports;

internal sealed class FootballRules : SportRule
{
    internal static readonly FootballRules Instance = new();
    internal override string Name => "Football";
    internal override SportUsual Usual { get; } = new(4, 15);

    protected override string? ClockInPlay(ProviderGame game, League league, int period) =>
        ClockFormat.Timed(game, period, league.Regulation, ClockFormat.QuarterOrHalf(league.Regulation));

    protected override bool HotSides(ProviderGame game, ProviderSides sides, int period, League league) =>
        HotFinish.Timed(game, sides, period, league.Regulation, TimeSpan.FromMinutes(4), withinPoints: 8);

    internal override string? When(ProviderScoringPlay play, League league) =>
        ClockFormat.WhenTimed(play, league, ClockFormat.QuarterOrHalf(league.Regulation));
}
