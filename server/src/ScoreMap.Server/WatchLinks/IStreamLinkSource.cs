using ScoreMap.Server.Games;

namespace ScoreMap.Server.WatchLinks;

/// <summary>
/// Where a game's unofficial stream links come from (ADR-0002). The game board asks it for each
/// game it shows. In the hobby v1 the <c>StreamFinder</c> fills it when Program.cs adds it;
/// otherwise <see cref="NoStreamLinks"/> stands in, so removing the finder leaves this seam in place.
/// </summary>
public interface IStreamLinkSource
{
    /// <summary>The game's stream links known now, without waiting on anything slow.</summary>
    IReadOnlyList<StreamLink> LinksFor(Game game);
}

/// <summary>The stream link source of a ScoreMap without the stream finder: no game has stream links.</summary>
public sealed class NoStreamLinks : IStreamLinkSource
{
    public IReadOnlyList<StreamLink> LinksFor(Game game) => [];
}
