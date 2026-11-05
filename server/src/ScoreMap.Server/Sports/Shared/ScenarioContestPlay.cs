using ScoreMap.Server.GameFeed;
using ScoreMap.Server.Games;
using ScoreMap.Server.Scenarios;
using ScoreMap.Server.Sports.Shared;

namespace ScoreMap.Server.Sports;

internal abstract partial class SportScenario
{
    /// <summary>This sport's field style. Fields that aren't golf's play as a race.</summary>
    protected virtual FieldPlay Field => RacingFieldPlay.Instance;

    /// <summary>Play for one of this sport's games, chosen by the shape of its contest.</summary>
    internal GamePlay PlayFor(ProviderContest contest) => contest switch
    {
        ProviderSides => CreatePlay(),
        ProviderField => Field,
        ProviderBouts => FightCardPlay.Instance,
        _ => throw new ArgumentOutOfRangeException(nameof(contest)),
    };

    /// <summary>
    /// A field or fight card played again from the start, as a new game with id <paramref name="replacementId"/>.
    /// A two-sided game is never played again: a made-up game between free teams takes its place.
    /// </summary>
    internal ProviderContest Replayed(ProviderContest contest, string replacementId) => contest switch
    {
        ProviderField field => Field.Reset(field),
        ProviderBouts card => FightCardPlay.Instance.Reset(card, replacementId),
        _ => throw new ArgumentOutOfRangeException(nameof(contest), "Only a field or a fight card is played again"),
    };
}
