using Microsoft.Extensions.Options;
using ScoreMap.Server.Games;

namespace ScoreMap.Server.Scenarios;

/// <summary>
/// The scenario files (ADR-0009), and the venue list and team list their fills draw on, where the
/// "Scenarios" settings put them: for the scenario pill on a local run, and for a demo anywhere (ADR-0019).
/// </summary>
public sealed class ScenarioLibrary
{
    private readonly string _folder;
    private readonly IReadOnlyList<League> _leagues;
    private readonly IReadOnlyList<ScenarioVenue>? _venues;
    private readonly ScenarioTeamList? _teams;

    public ScenarioLibrary(IHostEnvironment environment, IOptions<ScenarioOptions> options, IOptions<List<League>> leagues)
    {
        _folder = Path.Combine(environment.ContentRootPath, options.Value.Folder);
        _leagues = leagues.Value;
        // The venue list fills come from; without it, a scenario with a fill says so when read.
        var venueList = Path.Combine(environment.ContentRootPath, options.Value.VenueListPath);
        _venues = File.Exists(venueList) ? ScenarioVenue.ReadList(venueList) : null;
        // Likewise the team list fills make their games between.
        var teamList = Path.Combine(environment.ContentRootPath, options.Value.TeamListPath);
        _teams = File.Exists(teamList) ? ScenarioTeamList.Read(teamList) : null;
    }

    /// <summary>The names of the scenario files, in order.</summary>
    public IReadOnlyList<string> Names =>
        Directory.Exists(_folder)
            ? Directory.GetFiles(_folder, "*.json").Select(Path.GetFileNameWithoutExtension).OfType<string>()
                .Order(StringComparer.OrdinalIgnoreCase).ToList()
            : [];

    /// <summary>Reads scenario <paramref name="name"/>; a bad or missing file throws a <see cref="ScenarioFileException"/>.</summary>
    public Scenario Read(string name) => ScenarioReader.Read(_folder, name, _leagues, _venues, _teams);

    /// <summary>
    /// Scenario <paramref name="scenario"/>'s game feed provider, starting it now on <paramref name="clock"/>
    /// (the scenario clock).
    /// </summary>
    public ScenarioGameFeedProvider Start(Scenario scenario, TimeProvider clock) => new(scenario, clock, _leagues);
}
