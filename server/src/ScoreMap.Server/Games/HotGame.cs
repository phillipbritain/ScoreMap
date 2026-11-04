using ScoreMap.Server.Sports;
using ScoreMap.Server.Sports.Shared;
using ScoreMap.Server.GameFeed;

namespace ScoreMap.Server.Games;

/// <summary>
/// Whether a game is hot (see GLOSSARY.md): Live, the trailing side one score from tying or taking the
/// lead, and little left to play, judged by each sport's own rule from the score and what's left (never
/// win probability). In rugby, one score is a converted try. In basketball it's exactly clutch time. A fight card is hot while its main event is in
/// its last scheduled round; golf is hot late in a close final round; a race never is. Browsers show flames on a hot game, if the viewer has them on.
/// </summary>
public static class HotGame
{
    public static bool For(ProviderGame game, League league) => SportRules.For(league.Sport).Hot(game, league);
}
