using ScoreMap.Server.Sports;
using ScoreMap.Server.Sports.Shared;
using ScoreMap.Server.GameFeed;

namespace ScoreMap.Server.Games;

/// <summary>A tennis match's score set by set (see <see cref="GameScoreline"/>).</summary>
public static class Scoreline
{
    public static GameScoreline? For(ProviderGame game, League league) => SportRules.For(league.Sport).Scoreline(game);
}
