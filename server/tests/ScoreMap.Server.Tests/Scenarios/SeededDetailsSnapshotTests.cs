using System.Runtime.CompilerServices;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using Microsoft.Extensions.Time.Testing;
using ScoreMap.Server.GameFeed;
using ScoreMap.Server.Games;
using ScoreMap.Server.Scenarios;
using ScoreMap.Server.Tests.Support;

namespace ScoreMap.Server.Tests.Scenarios;

/// <summary>
/// Temporary: a seeded snapshot of scenario details (records, odds, crowd, notes, last scores, key events,
/// situations), kept while the details interface is reshaped (#294), as proof no sport's details change.
/// Deleted once the reshaping has been reviewed. Set SCOREMAP_WRITE_DETAILS_SNAPSHOT=1 to write it afresh.
/// </summary>
public sealed class SeededDetailsSnapshotTests
{
    private static readonly DateTimeOffset StartedAt = new(2026, 10, 4, 18, 0, 0, TimeSpan.Zero);

    [Fact]
    public void Seeded_details_are_the_same_as_before()
    {
        using var server = new ScoreMapServer { UseShippedScenarios = true };
        var library = server.Services.GetRequiredService<ScenarioLibrary>();
        var leagues = server.Services.GetRequiredService<IOptions<List<League>>>().Value;
        var scenarios = new[] { "crowded", "slow-initial-load", "worldwide", "edge-cases", "hot-finishes" }
            .Select(name => library.Read(name))
            .Append(Contests(library.Read("edge-cases"), leagues));

        var lines = new List<string>();
        foreach (var scenario in scenarios)
        {
            var clock = new FakeTimeProvider(StartedAt);
            var feed = new ScenarioGameFeedProvider(scenario, clock, leagues);
            // Every league every 6 s for 40 minutes, then every 5 minutes for 4 hours.
            for (var poll = 0; poll < 400 + 48; poll++)
            {
                var games = leagues.SelectMany(league => feed.FetchScoreboardAsync(league.Key, CancellationToken.None).Result).ToList();
                if (poll % 10 == 0 || poll >= 400)
                    lines.Add($"{scenario.Name} {clock.GetUtcNow() - StartedAt} {games.Count} {Hash(games)}");
                clock.Advance(poll < 400 ? TimeSpan.FromSeconds(6) : TimeSpan.FromMinutes(5));
            }
        }

        var path = SnapshotPath();
        if (Environment.GetEnvironmentVariable("SCOREMAP_WRITE_DETAILS_SNAPSHOT") == "1")
            File.WriteAllLines(path, lines);
        Assert.Equal(File.ReadAllLines(path), lines);
    }

    /// <summary>
    /// Every contest shape under play: edge-cases' written races, golf, fight card and team games,
    /// written tennis matches (shorthand, sets, upcoming), and made-up two-sided games in golf, tennis,
    /// MMA and racing leagues supplied with teams; replacements come from every league.
    /// </summary>
    private static Scenario Contests(Scenario edgeCases, IReadOnlyList<League> leagues)
    {
        var teams = new ScenarioTeamList(leagues.ToDictionary(
            league => league.Name,
            league => (IReadOnlyList<ScenarioTeam>)Enumerable.Range(1, 12)
                .Select(n => new ScenarioTeam($"{league.Name} team {n}", $"T{n}", null)).ToList()));
        var venues = ScenarioVenue.ReadList(Path.Combine(ScenarioVenueListTests.ServerProjectFolder, "scenario-venues.json"))
            .Where(venue => venue.Groups.Contains("worldwide")).ToList();
        var court = new ProviderVenue("Centre Court", "London", null, "England");
        ProviderSides Players(string home, string away, int? homeScore, int? awayScore) =>
            new(new ProviderTeam(home, home, null, homeScore), new ProviderTeam(away, away, null, awayScore));
        var games = edgeCases.Games.ToList();
        games.Add(new ScenarioGame("tennis-shorthand", "tennis/atp", TimeSpan.FromHours(-1),
            Players("J. Sinner", "C. Alcaraz", 1, 0), court, ProviderStatus.InProgress, null, 2, ProviderPeriodPhase.Playing));
        games.Add(new ScenarioGame("tennis-sets", "tennis/wta", TimeSpan.FromMinutes(-50),
            Players("A. Sabalenka", "I. Swiatek", null, null), court, ProviderStatus.InProgress, null, 2, ProviderPeriodPhase.Playing)
        {
            Sets = [new ProviderSet(7, 6, 7, 4, true), new ProviderSet(2, 3)],
        });
        games.Add(new ScenarioGame("tennis-upcoming", "tennis/atp", TimeSpan.FromMinutes(5),
            Players("N. Djokovic", "D. Medvedev", null, null), court, ProviderStatus.Scheduled, null, null, ProviderPeriodPhase.Playing));

        var random = new Random(100);
        var n = 0;
        foreach (var key in new[] { "golf/pga", "tennis/atp", "mma/ufc", "racing/f1" })
        {
            var maker = new ScenarioGameMaker([leagues.Single(league => league.Key == key)], teams);
            foreach (var status in Enum.GetValues<GameStatus>())
            {
                var playing = games.Where(game => game.Contest is ProviderSides)
                    .SelectMany(game => PlayingTeam.In(game.LeagueKey, game.Sides.Home, game.Sides.Away));
                games.Add(maker.Make($"made-{++n}", venues[n], status, playing, random));
            }
        }
        var settings = new PlaySettings(leagues, venues, new ScenarioGameMaker(leagues, teams), 0.1, new HashSet<string>());
        return new Scenario("contests", games, Play: settings);
    }

    private static string Hash(IReadOnlyList<ProviderGame> games)
    {
        var json = JsonSerializer.Serialize(games.Select(game => new { Game = game, Contest = (object)game.Contest }));
        return Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(json)))[..16];
    }

    private static string SnapshotPath([CallerFilePath] string source = "") =>
        Path.Combine(Path.GetDirectoryName(source)!, "SeededDetailsSnapshot.txt");
}
