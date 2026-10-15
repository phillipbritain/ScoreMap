using ScoreMap.Server.GameFeed;
using ScoreMap.Server.Games;

namespace ScoreMap.Server.Scenarios;

/// <summary>
/// The fake game feed provider (ADR-0009): stands in for ESPN's and answers from the running
/// scenario, so everything after the feed is the real code. The scenario starts when the provider
/// is made, and its timeline (if any) plays from then on the clock it is given, the scenario clock.
/// With play, the games play out from then, seeded by the scenario's name. Every game gets the game
/// panel's extra detail made up for it (see <see cref="ScenarioDetails"/>).
/// </summary>
public sealed class ScenarioGameFeedProvider : IGameFeedProvider
{
    private readonly Scenario _scenario;
    private readonly TimeProvider _clock;
    private readonly DateTimeOffset _startedAt;
    private readonly ScenarioPlay? _play;
    private readonly ScenarioDetails _details;

    public ScenarioGameFeedProvider(Scenario scenario, TimeProvider clock, IReadOnlyList<League> leagues)
    {
        _scenario = scenario;
        _clock = clock;
        _startedAt = clock.GetUtcNow();
        if (scenario.Play is not null)
            _play = new ScenarioPlay(scenario, _startedAt, new Random(Scenario.StableSeed(scenario.Name)));
        _details = new ScenarioDetails(leagues);
    }

    public Task<IReadOnlyList<ProviderGame>> FetchScoreboardAsync(string leagueKey, CancellationToken cancellationToken)
    {
        var now = _clock.GetUtcNow();
        var all = _play is not null ? _play.GamesAt(now) : _scenario.GamesAt(_startedAt, now);
        var games = _details.Fill(leagueKey, all.Where(game => game.LeagueKey == leagueKey).ToList());
        return Task.FromResult(games);
    }

    /// <summary>About one game in five, picked by its id, so a game stays a top event for as long as it runs.</summary>
    public Task<IReadOnlySet<string>> FetchTopEventsAsync(CancellationToken cancellationToken)
    {
        var now = _clock.GetUtcNow();
        var all = _play is not null ? _play.GamesAt(now) : _scenario.GamesAt(_startedAt, now);
        IReadOnlySet<string> top = all.Select(game => game.Id).Where(IsTopEvent).ToHashSet();
        return Task.FromResult(top);
    }

    private static bool IsTopEvent(string gameId) => (uint)Scenario.StableSeed(gameId) % 5 == 0;
}
