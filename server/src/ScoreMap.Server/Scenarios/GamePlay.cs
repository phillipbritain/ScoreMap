using ScoreMap.Server.GameFeed;

namespace ScoreMap.Server.Scenarios;

/// <summary>
/// How one game moves on under play, chosen once for it by the shape of its contest (two sides, a field
/// or a fight card; see <c>SportScenario.PlayFor</c>). Its sport supplies the rules within that shape:
/// team scoring or tennis's sets, and golf's or racing's field.
/// </summary>
internal abstract class GamePlay
{
    /// <summary>
    /// A Live game as play takes it on, and how far through its planned length it is (0 to 1): where it
    /// is written to stand if that says, otherwise <paramref name="sinceStart"/>, the share of its planned
    /// length since its start time.
    /// </summary>
    internal abstract Played TakeOn(ProviderGame game, double sinceStart);

    /// <summary>An Upcoming game at its start time, now Live.</summary>
    internal abstract Played Start(ProviderGame game, double step, Random random);

    /// <summary>
    /// A Live game <paramref name="through"/> its planned length moved on by <paramref name="step"/> of it.
    /// The game it gives is Final once it has finished.
    /// </summary>
    internal abstract Played Step(ProviderGame game, double through, double step, Random random);
}

/// <summary>A game as play leaves it, and how far through its planned length it is.</summary>
internal readonly record struct Played(ProviderGame Game, double Through);
