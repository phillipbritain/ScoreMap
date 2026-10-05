namespace ScoreMap.Server.Games;

/// <summary>Compares two updates of a league's games and lists the change events between them.</summary>
internal static class GameChanges
{
    public static IReadOnlyList<GameChange> Between(IReadOnlyList<Game> before, IReadOnlyList<Game> after)
    {
        var previous = before.ToDictionary(g => g.Id);
        var changes = new List<GameChange>();
        foreach (var game in after)
        {
            var kind = previous.TryGetValue(game.Id, out var old) ? Compare(old, game) : GameChangeKind.Added;
            if (kind is not null)
                changes.Add(new GameChange(kind.Value, game));
        }

        var current = after.Select(g => g.Id).ToHashSet();
        changes.AddRange(before
            .Where(g => !current.Contains(g.Id))
            .Select(g => new GameChange(GameChangeKind.Removed, g)));
        return changes;
    }

    /// <summary>The one change to report for a game in both updates, most notable first.</summary>
    private static GameChangeKind? Compare(Game before, Game after)
    {
        if (before.Status == GameStatus.Upcoming && after.Status == GameStatus.Live)
            return GameChangeKind.Started;
        if (before.Status != GameStatus.Final && after.Status == GameStatus.Final)
            return GameChangeKind.Finished;
        if (before.Home.Score != after.Home.Score || before.Away.Score != after.Away.Score)
            return GameChangeKind.ScoreChanged;
        if (!Same(before, after))
            return GameChangeKind.Updated;
        return null;
    }

    /// <summary>
    /// Record equality, except list fields compare by content (records compare lists by
    /// reference, and every fetch builds new lists). A new list field on <see cref="Game"/>
    /// must be added here, or every poll reports every game as updated.
    /// </summary>
    private static bool Same(Game before, Game after) =>
        before.Broadcasters.SequenceEqual(after.Broadcasters)
        && before with { Broadcasters = after.Broadcasters } == after;
}
