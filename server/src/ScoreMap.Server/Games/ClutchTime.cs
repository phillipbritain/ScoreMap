using ScoreMap.Server.Sports;
using ScoreMap.Server.Sports.Shared;
using ScoreMap.Server.GameFeed;

namespace ScoreMap.Server.Games;

/// <summary>
/// Whether a basketball game is in clutch time (see GLOSSARY.md): the last 5 minutes of the last period of
/// regulation, or any time in overtime, while the score is within 5 points. Borrowed from the NBA's
/// clutch-time stat. Browsers pulse a basketball score change only in clutch time, judged on the score
/// after the basket.
/// </summary>
public static class ClutchTime
{
    public static bool For(ProviderGame game, League league) => SportRules.For(league.Sport).Clutch(game, league);
}
