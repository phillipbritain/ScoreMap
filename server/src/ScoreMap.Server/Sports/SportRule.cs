using ScoreMap.Server.GameFeed;
using ScoreMap.Server.Games;

namespace ScoreMap.Server.Sports;

/// <summary>Pure interpretation of normalized feed facts, using the league's effective settings.</summary>
internal abstract class SportRule
{
    internal abstract string Name { get; }
    internal abstract SportUsual Usual { get; }

    internal string? Clock(ProviderGame game, League league)
    {
        if (game.Contest is ProviderBouts card)
            return MmaRules.FightCard(game, card);
        if (game.Status is not (ProviderStatus.InProgress or ProviderStatus.Delayed or ProviderStatus.Final)
            || game.Period is not { } period)
            return null;
        return ClockInPlay(game, league, period);
    }

    protected abstract string? ClockInPlay(ProviderGame game, League league, int period);

    internal bool Hot(ProviderGame game, League league)
    {
        if (game.Status is not (ProviderStatus.InProgress or ProviderStatus.Delayed))
            return false;
        if (game.Contest is ProviderBouts card)
            return MmaRules.HotCard(card);
        if (game.Period is not { } period)
            return false;
        if (game.Contest is ProviderField field)
            return HotField(game, field, period, league);
        return game.Contest is ProviderSides sides && HotSides(game, sides, period, league);
    }

    protected abstract bool HotSides(ProviderGame game, ProviderSides sides, int period, League league);
    protected virtual bool HotField(ProviderGame game, ProviderField field, int period, League league) => false;
    internal virtual bool Clutch(ProviderGame game, League league) => false;
    internal virtual GameScoreline? Scoreline(ProviderGame game) => null;
    internal virtual string? When(ProviderScoringPlay play, League league) => play.Clock;
}
