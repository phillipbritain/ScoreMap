using ScoreMap.Server.GameFeed;
using ScoreMap.Server.Games;
using ScoreMap.Server.Scenarios;

namespace ScoreMap.Server.Sports.Shared;

/// <summary>
/// Play for a game among a field, Final once it is through its planned length. A field style (golf's
/// rounds, racing's laps) supplies how far through a written one is, how it moves on, and how it starts again.
/// </summary>
internal abstract class FieldPlay : GamePlay
{
    protected abstract double Through(ProviderField field, int period, ProviderPeriodPhase phase);
    internal abstract ProviderField Reset(ProviderField field);
    protected abstract (ProviderGame Game, double Through) Advance(
        ProviderGame game, ProviderField field, double before, double through, Random random);

    internal sealed override Played TakeOn(ProviderGame game, double sinceStart) =>
        new(game, game.Period is { } period
            ? Through((ProviderField)game.Contest, period, game.Phase)
            : Math.Clamp(sinceStart, 0, 1));

    internal sealed override Played Start(ProviderGame game, double step, Random random) => Step(game, 0, step, random);

    internal sealed override Played Step(ProviderGame game, double through, double step, Random random)
    {
        game = game with { Status = ProviderStatus.InProgress };
        (game, through) = Advance(game, (ProviderField)game.Contest, through, Math.Min(1, through + step), random);
        if (through >= 1)
            game = game with { Status = ProviderStatus.Final, Phase = ProviderPeriodPhase.Playing };
        return new(game, through);
    }
}
