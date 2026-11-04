using ScoreMap.Server.GameFeed;
using ScoreMap.Server.Games;

namespace ScoreMap.Server.Sports;

using ScoreMap.Server.Sports.Shared;

internal sealed class FootballRules : SportRule
{
    internal static readonly FootballRules Instance = new();
    internal override string Name => "Football";
    internal override SportUsual Usual => new(4, 15);

    protected override string? ClockInPlay(ProviderGame game, League league, int period) =>
        ClockFormat.Timed(game, period, league.Regulation, league.Regulation == 2 ? "H" : "Q");

    protected override bool HotSides(ProviderGame game, ProviderSides sides, int period, League league) =>
        HotFinish.Timed(game, sides, period, league.Regulation, TimeSpan.FromMinutes(4), withinPoints: 8);

    internal override string? When(ProviderScoringPlay play, League league)
    {
        if (play.Period is not { } period)
            return play.Clock;
        var name = ClockFormat.PeriodName(period, league.Regulation, league.Regulation == 2 ? "H" : "Q");
        return play.Clock is { } clock ? $"{name} {clock}" : name;
    }
}
