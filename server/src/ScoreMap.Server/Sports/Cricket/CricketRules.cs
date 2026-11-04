using ScoreMap.Server.GameFeed;
using ScoreMap.Server.Games;

namespace ScoreMap.Server.Sports;

using ScoreMap.Server.Sports.Shared;

internal sealed class CricketRules : SportRule
{
    internal static readonly CricketRules Instance = new();
    internal override string Name => "Cricket";
    internal override SportUsual Usual => new(2, null);

    protected override string? ClockInPlay(ProviderGame game, League league, int period) =>
        Innings(game, period);

    protected override bool HotSides(ProviderGame game, ProviderSides sides, int period, League league) =>
        Cricket(sides);

    private static string Innings(ProviderGame game, int innings)
    {
        if (game.Status == ProviderStatus.Final)
            return "Final";
        if (game.Phase == ProviderPeriodPhase.Break)
            return "Innings break";

        if (game.Contest is not ProviderSides sides)
            return $"{ClockFormat.Ordinal(innings)} inns";
        var batting = new[] { sides.Home, sides.Away }
            .OrderByDescending(team => team.Innings?.Target is not null)
            .FirstOrDefault(team => team.Innings?.Overs is not null);
        if (batting?.Innings is not { Overs: { } overs } state)
            return $"{ClockFormat.Ordinal(innings)} inns";

        var line = state.OverLimit is { } limit ? $"{overs}/{limit} ov" : $"{overs} ov";
        return state.Target is { } target && batting.Score is { } runs && target > runs
            ? $"{line} · need {target - runs}"
            : line;
    }

    private const int BallsPerOver = 6;

    private static bool Cricket(ProviderSides sides)
    {
        var chasing = new[] { sides.Home, sides.Away }
            .FirstOrDefault(team => team.Innings is { Target: not null, Overs: not null });
        if (chasing is not { Score: { } runs, Innings: { Target: { } target, OverLimit: { } limit, Wickets: { } wickets } innings }
            || wickets >= 10
            || Balls(innings.Overs) is not { } bowled)
            return false;
        var ballsLeft = limit * BallsPerOver - bowled;
        var needs = target - runs;
        return ballsLeft is > 0 and <= 2 * BallsPerOver && needs > 0 && needs <= 2 * ballsLeft;
    }

    private static int? Balls(string? overs)
    {
        var parts = (overs ?? "").Split('.');
        if (parts.Length > 2 || !int.TryParse(parts[0], out var whole))
            return null;
        var part = 0;
        if (parts.Length == 2 && !int.TryParse(parts[1], out part))
            return null;
        return whole * BallsPerOver + part;
    }
}
