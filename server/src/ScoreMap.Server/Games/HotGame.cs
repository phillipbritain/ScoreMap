using ScoreMap.Server.GameFeed;

namespace ScoreMap.Server.Games;

/// <summary>
/// Whether a game is hot (see GLOSSARY.md): Live, the trailing side one score from tying or taking the
/// lead, and little left to play, judged by each sport's own rule from the score and what's left (never
/// win probability). In basketball it's exactly clutch time. Every rule so far is for a game between two
/// sides. Browsers show flames on a hot game, if the viewer has them on.
/// </summary>
public static class HotGame
{
    public static bool For(ProviderGame game, League league)
    {
        if (game.Status is not (ProviderStatus.InProgress or ProviderStatus.Delayed) || game.Period is not { } period
            || game.Contest is not ProviderSides sides)
            return false;

        return league.Sport switch
        {
            Sport.Basketball => ClutchTime.For(game, league),
            Sport.Football => Timed(game, sides, period, league.Regulation, TimeSpan.FromMinutes(4), withinPoints: 8),
            Sport.Hockey => game.Phase == ProviderPeriodPhase.Shootout
                || Timed(game, sides, period, league.Regulation, TimeSpan.FromMinutes(5), withinPoints: 1),
            Sport.Soccer => Soccer(game, sides, period, league.Regulation),
            Sport.Baseball => Baseball(game, sides, period, league.Regulation),
            Sport.Cricket => Cricket(sides),
            _ => false,
        };
    }

    /// <summary>
    /// A sport with a game clock counting down: the last <paramref name="lastMinutes"/> of the last period
    /// of regulation, or any time in overtime, within <paramref name="withinPoints"/>.
    /// </summary>
    private static bool Timed(ProviderGame game, ProviderSides sides, int period, int regulation, TimeSpan lastMinutes, int withinPoints)
    {
        if (Margin(sides) is not { } margin || margin > withinPoints)
            return false;
        return period > regulation || (period == regulation && PeriodClock.TimeLeft(game.DisplayClock) <= lastMinutes);
    }

    /// <summary>
    /// Soccer counts minutes up ("85'", "90'+3'"): from the 85th minute of the second half, or the 115th of
    /// extra time, within a goal; any time in a penalty shootout.
    /// </summary>
    private static bool Soccer(ProviderGame game, ProviderSides sides, int period, int regulation)
    {
        if (game.Phase == ProviderPeriodPhase.Shootout)
            return true;
        if (Margin(sides) is not (0 or 1))
            return false;
        var digits = new string((game.DisplayClock ?? "").TakeWhile(char.IsAsciiDigit).ToArray());
        if (!int.TryParse(digits, out var minute))
            return false;
        return period == regulation ? minute >= 85 : period > regulation && minute >= 115;
    }

    /// <summary>
    /// From the last inning of regulation on, while the tying run is on base or at the plate: the side
    /// batting is tied, or behind by no more than its runners on base plus one. Not between half-innings.
    /// </summary>
    private static bool Baseball(ProviderGame game, ProviderSides sides, int inning, int regulation)
    {
        var (batting, fielding) = game.Phase switch
        {
            ProviderPeriodPhase.InningTop => (sides.Away, sides.Home),
            ProviderPeriodPhase.InningBottom => (sides.Home, sides.Away),
            _ => (null, null),
        };
        if (inning < regulation || batting?.Score is not { } runs || fielding?.Score is not { } against)
            return false;
        var situation = game.Situation;
        var runners = new[] { situation?.OnFirst, situation?.OnSecond, situation?.OnThird }.Count(on => on == true);
        return against - runs is var behind && behind >= 0 && behind <= runners + 1;
    }

    private const int BallsPerOver = 6;

    /// <summary>
    /// The last 2 overs of a limited-overs chase, while the chasing side still needs runs, needs no more than
    /// 2 a ball, and has wickets left. Never without an over limit (a Test).
    /// </summary>
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

    /// <summary>The balls in overs as cricket writes them ("13.2": 13 overs and 2 balls); null if they can't be read.</summary>
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

    /// <summary>How far apart the two scores are; null while either side has none.</summary>
    private static int? Margin(ProviderSides sides) =>
        sides.Home.Score is { } home && sides.Away.Score is { } away ? Math.Abs(home - away) : null;
}
