using ScoreMap.Server.GameFeed;

namespace ScoreMap.Server.Scenarios;

/// <summary>
/// The fake game feed provider (ADR-0009): stands in for ESPN's and answers from the running
/// scenario, so everything after the feed is the real code. The scenario starts when the provider
/// is made, and its timeline (if any) plays from then on the clock it is given, the scenario clock.
/// With random play, the games play out from then, seeded by the scenario's name.
/// </summary>
public sealed class ScenarioGameFeedProvider : IGameFeedProvider
{
    private readonly Scenario _scenario;
    private readonly TimeProvider _clock;
    private readonly DateTimeOffset _startedAt;
    private readonly RandomPlayGames? _randomPlay;

    public ScenarioGameFeedProvider(Scenario scenario, TimeProvider clock)
    {
        _scenario = scenario;
        _clock = clock;
        _startedAt = clock.GetUtcNow();
        if (scenario.Play is not null)
            _randomPlay = new RandomPlayGames(scenario, _startedAt, new Random(Scenario.StableSeed(scenario.Name)));
    }

    public Task<IReadOnlyList<ProviderGame>> FetchScoreboardAsync(string leagueKey, CancellationToken cancellationToken)
    {
        var now = _clock.GetUtcNow();
        var all = _randomPlay is not null ? _randomPlay.GamesAt(now) : _scenario.GamesAt(_startedAt, now);
        IReadOnlyList<ProviderGame> games = all.Where(game => game.LeagueKey == leagueKey).ToList();
        return Task.FromResult(games);
    }
}
