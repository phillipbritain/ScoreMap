using Microsoft.Extensions.Options;
using ScoreMap.Server.GameFeed;
using ScoreMap.Server.Games;
using ScoreMap.Server.Live;

namespace ScoreMap.Server.Scenarios;

/// <summary>
/// The game feed provider when ScoreMap runs locally (ADR-0009): answers from the running scenario,
/// or from real games, and can be switched between them while the server runs. One source at a time
/// serves every browser. Picking a scenario starts it afresh, on the real clock.
/// </summary>
public sealed class ScenarioSwitcher : IGameFeedProvider
{
    /// <summary>The name that stands for real games, in the "Scenario" setting and in a switch.</summary>
    public const string RealGames = "real";

    /// <summary>The key the real games' provider (ESPN's) is registered under, behind the switcher.</summary>
    public const string RealGamesKey = "real-games";

    /// <summary>A scenario fetches every league every second, so scripted changes show up straight away.</summary>
    public static readonly PollingOptions ScenarioPolling = new()
    {
        LiveInterval = TimeSpan.FromSeconds(1),
        QuietInterval = TimeSpan.FromSeconds(1),
    };

    private readonly IServiceProvider _services;
    private readonly IGameFeedProvider _realGames;
    private readonly PollingOptions _realPolling;
    private readonly string _folder;
    private readonly IReadOnlyList<League> _leagues;
    private volatile Source _running;

    private sealed record Source(string Name, IGameFeedProvider Feed);

    public ScenarioSwitcher(
        IServiceProvider services,
        [FromKeyedServices(RealGamesKey)] IGameFeedProvider realGames,
        IConfiguration configuration,
        IHostEnvironment environment,
        IOptions<ScenarioOptions> options,
        IOptions<List<League>> leagues,
        string startWith)
    {
        _services = services;
        _realGames = realGames;
        _realPolling = configuration.GetSection("Polling").Get<PollingOptions>() ?? new PollingOptions();
        _folder = Path.Combine(environment.ContentRootPath, options.Value.Folder);
        _leagues = leagues.Value;
        _running = Start(startWith);
    }

    /// <summary>The running scenario's name, or <see cref="RealGames"/>.</summary>
    public string Running => _running.Name;

    /// <summary>How often the poller should fetch for the running source.</summary>
    public PollingOptions Polling => IsRealGames(_running.Name) ? _realPolling : ScenarioPolling;

    /// <summary>The names of the scenario files, in order.</summary>
    public IReadOnlyList<string> Scenarios =>
        Directory.Exists(_folder)
            ? Directory.GetFiles(_folder, "*.json").Select(Path.GetFileNameWithoutExtension).OfType<string>()
                .Order(StringComparer.OrdinalIgnoreCase).ToList()
            : [];

    /// <summary>
    /// Whether <paramref name="name"/> is something to switch to: a scenario file, or <see cref="RealGames"/>.
    /// </summary>
    public bool Has(string name) => IsRealGames(name) || Scenarios.Contains(name);

    /// <summary>
    /// Switches to the scenario <paramref name="name"/>, started afresh, or to real games. A bad scenario
    /// file throws a <see cref="ScenarioFileException"/> and leaves the running source as it was.
    /// </summary>
    public void SwitchTo(string name) => _running = Start(name);

    public Task<IReadOnlyList<ProviderGame>> FetchScoreboardAsync(string leagueKey, CancellationToken cancellationToken) =>
        _running.Feed.FetchScoreboardAsync(leagueKey, cancellationToken);

    private Source Start(string name)
    {
        if (IsRealGames(name))
            return new Source(RealGames, _realGames);
        var scenario = ScenarioReader.Read(_folder, name, _leagues);
        return new Source(name, ActivatorUtilities.CreateInstance<ScenarioGameFeedProvider>(_services, scenario));
    }

    private static bool IsRealGames(string name) => name.Equals(RealGames, StringComparison.OrdinalIgnoreCase);
}
