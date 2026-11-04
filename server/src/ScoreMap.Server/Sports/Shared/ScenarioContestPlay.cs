using ScoreMap.Server.GameFeed;
using ScoreMap.Server.Games;
using ScoreMap.Server.Scenarios;
using ScoreMap.Server.Sports.Shared;

namespace ScoreMap.Server.Sports;

internal abstract partial class SportScenario
{
    // Every sport explicitly selects its field style. Existing non-golf written fields use racing play.
    protected abstract FieldPlay Field { get; }

    internal double FieldThrough(ProviderField field, int period, ProviderPeriodPhase phase) =>
        Field.Through(field, period, phase);

    internal ProviderContest ResetContest(ProviderContest contest, string replacementId) => contest switch
    {
        ProviderField field => Field.Reset(field),
        ProviderBouts card => MmaScenario.ResetCard(card, replacementId),
        ProviderSides => contest,
        _ => throw new ArgumentOutOfRangeException(nameof(contest)),
    };

    /// <summary>
    /// Whether play moves this sport's two-sided games on itself (<see cref="PlaySides"/>), as it does
    /// a field or a fight card, rather than through its <see cref="SportPlay"/>: tennis, whose sets live on the game.
    /// </summary>
    internal virtual bool PlaysSidesItself => false;

    /// <summary>A Live two-sided game as play takes it on, for a sport that plays them itself.</summary>
    internal virtual ProviderGame TakeOn(ProviderGame game) => game;

    /// <summary>Moves a two-sided game on from <paramref name="before"/> to <paramref name="through"/>, for a sport that plays them itself.</summary>
    protected virtual (ProviderGame Game, double Through) PlaySides(ProviderGame game, double before, double through, Random random) =>
        throw new InvalidOperationException($"{League.Sport} games play through their SportPlay");

    internal (ProviderGame Game, double Through) PlayContest(ProviderGame game, double before, double through, Random random)
    {
        game = game with { Status = ProviderStatus.InProgress };
        if (game.Contest is ProviderField field)
            (game, through) = Field.Advance(game, field, before, through, random);
        else if (game.Contest is ProviderBouts card)
            game = MmaScenario.AdvanceCard(game, card, random);
        else if (game.Contest is ProviderSides)
            (game, through) = PlaySides(game, before, through, random);
        if (game.Contest is ProviderField && through >= 1)
            game = game with { Status = ProviderStatus.Final, Phase = ProviderPeriodPhase.Playing };
        return (game, through);
    }
}
