using ScoreMap.Server.GameFeed;

namespace ScoreMap.Server.Games;

/// <summary>
/// The short line saying where a game stands, written the way its sport reads it:
/// "Q3 4:12", "Halftime", "Final/OT" and so on.
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
            "American football" or "Basketball" => Timed(game, period, league.RegulationPeriods ?? 4,
                league.RegulationPeriods == 2 ? "H" : "Q"),
            "Hockey" => Timed(game, period, league.RegulationPeriods ?? 3, "P"),
            "Baseball" => Innings(game, period, league.RegulationPeriods ?? 9),
            "Soccer" => Halves(game, period, league.RegulationPeriods ?? 2),
            _ => game.DisplayClock,
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
