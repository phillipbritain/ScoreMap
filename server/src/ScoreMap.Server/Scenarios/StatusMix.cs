using ScoreMap.Server.Games;

namespace ScoreMap.Server.Scenarios;

/// <summary>
/// The share of filled games in each status (ADR-0009), as weights: <c>{ "live": 3, "final": 1 }</c>
/// makes three Live games for each Final one. Statuses left out get none.
/// </summary>
public sealed record StatusMix(IReadOnlyDictionary<GameStatus, double> Shares)
{
    /// <summary>Every filled game Live, when a fill gives no mix.</summary>
    public static readonly StatusMix AllLive = new(new Dictionary<GameStatus, double> { [GameStatus.Live] = 1 });

    /// <summary>
    /// The statuses of <paramref name="count"/> games, split by the shares and shuffled. Each status
    /// gets the whole games of its share; the games left over go to the statuses with the largest
    /// remainders.
    /// </summary>
    public IReadOnlyList<GameStatus> Split(int count, Random random)
    {
        var total = Shares.Values.Sum();
        var exact = Shares
            .OrderBy(share => share.Key)
            .Select(share => (Status: share.Key, Games: count * share.Value / total))
            .ToList();
        var whole = exact.ToDictionary(share => share.Status, share => (int)Math.Floor(share.Games));
        var left = count - whole.Values.Sum();
        foreach (var share in exact.OrderByDescending(share => share.Games - Math.Floor(share.Games)).Take(left))
            whole[share.Status]++;

        var statuses = whole.SelectMany(share => Enumerable.Repeat(share.Key, share.Value)).ToArray();
        random.Shuffle(statuses);
        return statuses;
    }
}
