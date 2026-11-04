using ScoreMap.Server.GameFeed;
using ScoreMap.Server.Games;

namespace ScoreMap.Server.Sports.Shared;

internal static class ClockFormat
{
    internal static string PeriodName(int period, int regulation, string prefix) =>
        period > regulation ? OvertimeName(period - regulation) : $"{prefix}{period}";

    internal static string? Halves(ProviderGame game, int period, int regulation)
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

    internal static string Innings(ProviderGame game, int inning, int regulation)
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

    internal static string Ordinal(int n) => (n % 100, n % 10) switch
    {
        (11 or 12 or 13, _) => $"{n}th",
        (_, 1) => $"{n}st",
        (_, 2) => $"{n}nd",
        (_, 3) => $"{n}rd",
        _ => $"{n}th",
    };

    internal static string Timed(ProviderGame game, int period, int regulation, string prefix)
    {
        var overtime = period > regulation;
        if (game.Status == ProviderStatus.Final)
            return overtime ? "Final/OT" : "Final";

        if (game.Phase == ProviderPeriodPhase.Shootout)
            return "SO";

        var name = PeriodName(period, regulation, prefix);
        if (game.Phase == ProviderPeriodPhase.Break)
            return period * 2 == regulation ? "Halftime" : $"End {name}";
        return $"{name} {game.DisplayClock}";
    }

    internal static string OvertimeName(int overtime) => overtime == 1 ? "OT" : $"{overtime}OT";
}
