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
        if (ScoreChanged(before.Contest, after.Contest))
            return GameChangeKind.ScoreChanged;
        if (!Same(before, after))
            return GameChangeKind.Updated;
        return null;
    }

    /// <summary>
    /// Two sides' score changes when either side's does; a field's when the lead changes hands (ADR-0020):
    /// someone leads alone who didn't before, from another leading alone or from a tie for the lead. A tie
    /// for the lead is no change until someone leads alone, nor is the field first being listed.
    /// </summary>
    private static bool ScoreChanged(GameContest before, GameContest after) => (before, after) switch
    {
        (GameSides b, GameSides a) => b.Home.Score != a.Home.Score || b.Away.Score != a.Away.Score,
        (GameField b, GameField a) => b.Entries.Count > 0 && Leader(a) is { } now && Leader(b)?.Name != now.Name,
        _ => throw new ArgumentOutOfRangeException(nameof(after), after, "No score change for this contest"),
    };

    /// <summary>The entrant leading alone; null with no field yet, or with more than one at the front.</summary>
    private static GameEntrant? Leader(GameField field) =>
        field.Entries.Count(entrant => entrant.Position == 1) == 1 ? field.Entries[0] : null;

    /// <summary>
    /// Record equality, except list fields compare by content (records compare lists by
    /// reference, and every fetch builds new lists). A new list field on <see cref="Game"/>
    /// must be added here, or every poll reports every game as updated.
    /// </summary>
    private static bool Same(Game before, Game after) =>
        before.Broadcasters.SequenceEqual(after.Broadcasters)
        && before.StreamLinks.SequenceEqual(after.StreamLinks)
        && before.KeyEvents.SequenceEqual(after.KeyEvents)
        && before with { Broadcasters = after.Broadcasters, StreamLinks = after.StreamLinks, KeyEvents = after.KeyEvents } == after;
}
