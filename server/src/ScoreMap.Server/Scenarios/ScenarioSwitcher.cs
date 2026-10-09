using Microsoft.Extensions.Options;
using ScoreMap.Server.GameFeed;
using ScoreMap.Server.Games;
using ScoreMap.Server.Live;

namespace ScoreMap.Server.Scenarios;

/// <summary>
/// The game feed provider when ScoreMap runs locally (ADR-0009): answers from the running scenario,
/// or from real games, and can be switched between them while the server runs. One source at a time
/// serves every browser. Picking a scenario starts it afresh, with the scenario clock set to the real
/// time and running at the speed it had; the speed can be changed while a scenario runs. Make switches
/// and changes of speed through <see cref="Poller.StartAfreshAsync"/>, between the poller's fetches, so
/// none reads the old scenario on the new clock.
/// </summary>
public sealed class ScenarioSwitcher : IGameFeedProvider
{
    /// <summary>The name that stands for real games, in the "Scenario" setting and in a switch.</summary>
    public const string RealGames = "real";

    /// <summary>The key the real games' provider (ESPN's) is registered under, behind the switcher.</summary>
    public const string RealGamesKey = "real-games";

    /// <summary>The most often a scenario is fetched, however fast its clock runs.</summary>
    public static readonly TimeSpan FastestPolling = TimeSpan.FromMilliseconds(250);

    private readonly IGameFeedProvider _realGames;
    private readonly PollingOptions _realPolling;
    private readonly string _folder;
    private readonly IReadOnlyList<League> _leagues;
    private readonly IReadOnlyList<ScenarioVenue>? _venues;
    private readonly TimeProvider _realTime;
    private readonly ScenarioClock _clock;
    private volatile Source _running;

    private sealed record Source(string Name, IGameFeedProvider Feed);

    public ScenarioSwitcher(
        [FromKeyedServices(RealGamesKey)] IGameFeedProvider realGames,
        IOptions<PollingOptions> realPolling,
        IHostEnvironment environment,
        IOptions<ScenarioOptions> options,
        IOptions<List<League>> leagues,
        TimeProvider realTime,
        string startWith,
        Speed speed)
    {
        _realGames = realGames;
        _realPolling = realPolling.Value;
        _folder = Path.Combine(environment.ContentRootPath, options.Value.Folder);
        _leagues = leagues.Value;
        // The venue list fills come from; without it, a scenario with a fill says so when picked.
        var venueList = Path.Combine(environment.ContentRootPath, options.Value.VenueListPath);
        _venues = File.Exists(venueList) ? ScenarioVenue.ReadList(venueList) : null;
        _realTime = realTime;
        _clock = new ScenarioClock(realTime, speed);
        BoardClock = new BoardTime(this);
        _running = Start(startWith);
    }

    /// <summary>The running scenario's name, or <see cref="RealGames"/>.</summary>
    public string Running => _running.Name;

    /// <summary>
    /// How often the poller should fetch for the running source: for a scenario, every league every
    /// second of real time divided by the speed, so scripted changes show up straight away and don't
    /// arrive bunched together at high speeds, but no more often than <see cref="FastestPolling"/>.
    /// Paused, it fetches as at Normal.
    /// </summary>
    public PollingOptions Polling
    {
        get
        {
            if (IsRealGames(_running.Name))
                return _realPolling;
            var interval = TimeSpan.FromSeconds(1) / Math.Max(_clock.Speed.Times, Speed.Normal.Times);
            if (interval < FastestPolling)
                interval = FastestPolling;
            return new PollingOptions { LiveInterval = interval, QuietInterval = interval };
        }
    }

    /// <summary>How fast the scenario clock runs, kept while real games run.</summary>
    public Speed Speed => _clock.Speed;

    /// <summary>The time games are on now: the scenario clock while a scenario runs, else the real time.</summary>
    public ClockAnchor Clock
    {
        get
        {
            if (!IsRealGames(_running.Name))
                return _clock.Anchor;
            return ClockAnchor.RealTime(_realTime);
        }
    }

    /// <summary>The game board's clock: <see cref="Clock"/>'s reading.</summary>
    public TimeProvider BoardClock { get; }

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
    /// Switches to the scenario <paramref name="name"/>, started afresh, or to real games, and returns the
    /// <see cref="Polling"/> for it. A bad scenario file throws a <see cref="ScenarioFileException"/> and
    /// leaves the running source as it was.
    /// </summary>
    public PollingOptions SwitchTo(string name)
    {
        _running = Start(name);
        return Polling;
    }

    /// <summary>
    /// Runs the scenario clock at <paramref name="speed"/> from its reading now, so the running scenario
    /// carries on from where it is, and returns the <see cref="Polling"/> for that speed. Throws an
    /// <see cref="InvalidOperationException"/> while real games run, which play in real time.
    /// </summary>
    public PollingOptions ChangeSpeed(Speed speed)
    {
        if (IsRealGames(_running.Name))
            throw new InvalidOperationException("Real games play in real time, so their speed can't be changed");
        _clock.ChangeSpeed(speed);
        return Polling;
    }

    public Task<IReadOnlyList<ProviderGame>> FetchScoreboardAsync(string leagueKey, CancellationToken cancellationToken) =>
        _running.Feed.FetchScoreboardAsync(leagueKey, cancellationToken);

    private Source Start(string name)
    {
        if (IsRealGames(name))
            return new Source(RealGames, _realGames);
        var scenario = ScenarioReader.Read(_folder, name, _leagues, _venues);
        _clock.Restart();
        return new Source(name, new ScenarioGameFeedProvider(scenario, _clock));
    }

    private static bool IsRealGames(string name) => name.Equals(RealGames, StringComparison.OrdinalIgnoreCase);

    /// <summary>A clock reading the switcher's <see cref="Clock"/>; timers and timestamps stay on the real clock.</summary>
    private sealed class BoardTime(ScenarioSwitcher switcher) : TimeProvider
    {
        public override DateTimeOffset GetUtcNow() => switcher.Clock.Reads;
    }
}
