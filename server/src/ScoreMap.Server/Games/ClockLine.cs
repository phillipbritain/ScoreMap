using ScoreMap.Server.GameFeed;

namespace ScoreMap.Server.Games;

/// <summary>
/// The short line saying where a game stands, written the way its sport reads it:
/// "Q3 4:12", "Halftime", "Final/OT", "13.2/20 ov · need 87" and so on.
/// </summary>
public static class ClockLine
{
    public static string? For(ProviderGame game, League league)
    {
        if (game.Status is not (ProviderStatus.InProgress or ProviderStatus.Delayed or ProviderStatus.Final)
            || game.Period is not { } period)
            return null;

        return league.Sport switch
        {
            Sport.Football or Sport.Basketball => Timed(game, period, league.Regulation, league.Regulation == 2 ? "H" : "Q"),
            Sport.Hockey => Timed(game, period, league.Regulation, "P"),
            Sport.Baseball => Innings(game, period, league.Regulation),
            Sport.Soccer => Halves(game, period, league.Regulation),
            Sport.Cricket => Innings(game, period),
            _ => throw new ArgumentOutOfRangeException(nameof(league), league.Sport, "No clock line for this sport"),
        };
    }

    /// <summary>Soccer counts minutes up: "67'", "HT", "ET HT", "Pens", "FT", "AET".</summary>
    private static string? Halves(ProviderGame game, int period, int regulation)
    {
        if (game.Status == ProviderStatus.Final)
            return period > regulation ? "AET" : "FT";
        return game.Phase switch
        {
            ProviderPeriodPhase.Shootout => "Pens",
            ProviderPeriodPhase.Break when period == 1 => "HT",
            ProviderPeriodPhase.Break when period == regulation + 1 => "ET HT",
            _ => game.DisplayClock,
        };
    }

    /// <summary>Baseball has no clock: "Top 7th", "Mid 7th", "Bot 7th", "End 7th", "Final/10".</summary>
    private static string Innings(ProviderGame game, int inning, int regulation)
    {
        if (game.Status == ProviderStatus.Final)
            return inning > regulation ? $"Final/{inning}" : "Final";

        var half = game.Phase switch
        {
            ProviderPeriodPhase.InningTop => "Top ",
            ProviderPeriodPhase.InningMiddle => "Mid ",
            ProviderPeriodPhase.InningBottom => "Bot ",
            ProviderPeriodPhase.InningEnd => "End ",
            _ => "",
        };
        return half + Ordinal(inning);
    }

    /// <summary>
    /// Cricket has no clock: the overs bowled to the side batting, and in a chase the runs it still needs:
    /// "13.2/20 ov", "13/20 ov · need 87", "Innings break", "Final". With no side batting yet, the innings:
    /// "1st inns".
    /// </summary>
    private static string Innings(ProviderGame game, int innings)
    {
        if (game.Status == ProviderStatus.Final)
            return "Final";
        if (game.Phase == ProviderPeriodPhase.Break)
            return "Innings break";

        var batting = new[] { game.Home, game.Away }
            .OrderByDescending(team => team.Innings?.Target is not null)
            .FirstOrDefault(team => team.Innings?.Overs is not null);
        if (batting?.Innings is not { Overs: { } overs } state)
            return $"{Ordinal(innings)} inns";

        var line = state.OverLimit is { } limit ? $"{overs}/{limit} ov" : $"{overs} ov";
        return state.Target is { } target && batting.Score is { } runs && target > runs
            ? $"{line} · need {target - runs}"
            : line;
    }

    private static string Ordinal(int n) => (n % 100, n % 10) switch
    {
        (11 or 12 or 13, _) => $"{n}th",
        (_, 1) => $"{n}st",
        (_, 2) => $"{n}nd",
        (_, 3) => $"{n}rd",
        _ => $"{n}th",
    };

    /// <summary>Sports played in timed periods with a running clock: "Q3 4:12", "End Q1", "Halftime", "OT 7:30".</summary>
    private static string Timed(ProviderGame game, int period, int regulation, string prefix)
    {
        var overtime = period > regulation;
        if (game.Status == ProviderStatus.Final)
            return overtime ? "Final/OT" : "Final";

        if (game.Phase == ProviderPeriodPhase.Shootout)
            return "SO";

        var name = overtime ? OvertimeName(period - regulation) : $"{prefix}{period}";
        if (game.Phase == ProviderPeriodPhase.Break)
            return period * 2 == regulation ? "Halftime" : $"End {name}";
        return $"{name} {game.DisplayClock}";
    }

    private static string OvertimeName(int overtime) => overtime == 1 ? "OT" : $"{overtime}OT";
}
