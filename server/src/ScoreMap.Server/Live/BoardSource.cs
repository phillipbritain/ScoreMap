using ScoreMap.Server.GameFeed;
using ScoreMap.Server.Scenarios;

namespace ScoreMap.Server.Live;

/// <summary>
/// A running board's feed, game clock, starting polling and optional scenario controls.
/// Real scheduling time stays with the board, separate from the time its games run on.
/// </summary>
public sealed record BoardSource(
    IGameFeedProvider Feed, TimeProvider GameClock, PollingOptions Polling, ScenarioSwitcher? Controls);
