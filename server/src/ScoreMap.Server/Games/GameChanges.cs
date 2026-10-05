using ScoreMap.Server.GameFeed;

namespace ScoreMap.Server.Games;

/// <summary>A game on the board, with the provider status change detection needs.</summary>
internal sealed record TrackedGame(Game Game, ProviderStatus Status)
{
    public bool IsLive => Status is ProviderStatus.InProgress or ProviderStatus.Delayed;
    public bool IsUpcoming => Status is ProviderStatus.Scheduled;
    public bool IsFinal => Status is ProviderStatus.Final;
}

/// <summary>Compares two fetches of a league's games and lists the change events between them.</summary>
internal static class GameChanges
{
    public static IReadOnlyList<GameChange> Between(IReadOnlyList<TrackedGame> before, IReadOnlyList<TrackedGame> after)
    {
        var previous = before.ToDictionary(g => g.Game.Id);
        var changes = new List<GameChange>();
        foreach (var game in after)
        {
            var kind = previous.TryGetValue(game.Game.Id, out var old) ? Compare(old, game) : GameChangeKind.Added;
            if (kind is not null)
                changes.Add(new GameChange(kind.Value, game.Game));
        }

        var current = after.Select(g => g.Game.Id).ToHashSet();
        changes.AddRange(before
            .Where(g => !current.Contains(g.Game.Id))
            .Select(g => new GameChange(GameChangeKind.Removed, g.Game)));
        return changes;
    }

    /// <summary>The one change to report for a game seen in both fetches, most notable first.</summary>
    private static GameChangeKind? Compare(TrackedGame before, TrackedGame after)
    {
        if (before.IsUpcoming && after.IsLive)
            return GameChangeKind.Started;
        if (!before.IsFinal && after.IsFinal)
            return GameChangeKind.Finished;
        if (before.Game.Home.Score != after.Game.Home.Score || before.Game.Away.Score != after.Game.Away.Score)
            return GameChangeKind.ScoreChanged;
        if (before != after)
            return GameChangeKind.Updated;
        return null;
    }
}
