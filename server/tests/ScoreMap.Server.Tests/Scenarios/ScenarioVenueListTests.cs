using System.Text.Json;
using ScoreMap.Server.GameFeed;
using ScoreMap.Server.Scenarios;
using ScoreMap.Server.Venues;

namespace ScoreMap.Server.Tests.Scenarios;

/// <summary>The venue list and checked-in lookups that ship in the repo (ADR-0009, ADR-0028).</summary>
public class ScenarioVenueListTests
{
    internal static readonly string ServerProjectFolder = Path.Combine(FindServerFolder(), "src", "ScoreMap.Server");

    private static readonly IReadOnlyList<ScenarioVenue> Venues =
        ScenarioVenue.ReadList(Path.Combine(ServerProjectFolder, "scenario-venues.json"));

    /// <summary>The server folder (holding ScoreMap.slnx), found by walking up from the test binaries.</summary>
    private static string FindServerFolder()
    {
        for (var dir = new DirectoryInfo(AppContext.BaseDirectory); dir is not null; dir = dir.Parent)
            if (File.Exists(Path.Combine(dir.FullName, "ScoreMap.slnx")))
                return dir.FullName;
        throw new InvalidOperationException("ScoreMap.slnx not found above " + AppContext.BaseDirectory);
    }

    private static readonly Dictionary<string, List<ScenarioTeam>> Teams =
        JsonSerializer.Deserialize<Dictionary<string, List<ScenarioTeam>>>(
            File.ReadAllText(Path.Combine(ServerProjectFolder, "scenario-teams.json")), new JsonSerializerOptions(JsonSerializerDefaults.Web))!;

    private static readonly HashSet<string> ConfiguredLeagues = JsonDocument
        .Parse(File.ReadAllText(Path.Combine(ServerProjectFolder, "appsettings.json")))
        .RootElement.GetProperty("Leagues").EnumerateArray()
        .Select(league => league.GetProperty("Name").GetString()!)
        .ToHashSet();

    [Fact]
    public void Every_venue_is_one_place_with_the_configured_leagues_that_play_there_each_at_most_once()
    {
        Assert.InRange(Venues.Count, 400, 600);
        Assert.Equal(Venues.Count, Venues.Select(v => v.Name).Distinct().Count());
        Assert.All(Venues, v =>
        {
            Assert.NotEmpty(v.Leagues);
            Assert.Equal(v.Leagues.Count, v.Leagues.Select(l => l.League).Distinct().Count());
            Assert.All(v.Leagues, l => Assert.Contains(l.League, ConfiguredLeagues));
        });
    }

    [Fact]
    public void Every_home_team_is_in_the_team_list_and_every_team_has_a_home_but_the_world_cups()
    {
        // The venues only written-out games use have their home teams in those games, not the team list.
        var homes = Venues.Where(v => !v.Groups.Contains("written-out")).SelectMany(v => v.Leagues).SelectMany(l => (l.Home ?? []).Select(team => (l.League, team))).ToList();

        Assert.All(homes, home => Assert.Contains(Teams[home.League], team => team.Name == home.team));
        // A team's home is one venue.
        Assert.Equal(homes.Count, homes.Distinct().Count());
        // Every team but the World Cup's (played at neutral sites) has a home, but the few college baseball
        // teams whose only "home" games ESPN listed were early-season tournaments out of state.
        var homeless = Teams.Where(league => league.Key != "World Cup")
            .SelectMany(league => league.Value.Select(team => (League: league.Key, team.Name)))
            .Where(team => !homes.Contains((team.League, team.Name)))
            .ToList();
        Assert.All(homeless, team => Assert.Equal("NCAA Baseball", team.League));
        Assert.InRange(homeless.Count, 0, 30);
    }

    [Fact]
    public void Every_venue_is_in_a_group_and_the_groups_have_room_for_the_scenarios_that_fill_from_them()
    {
        Assert.All(Venues, v => Assert.NotEmpty(v.Groups));
        int InGroup(string group) => Venues.Count(v => v.Groups.Contains(group));
        // worldwide fills 48 and slow-initial-load 60; play needs free venues beside them.
        Assert.InRange(InGroup("worldwide"), 150, 300);
        Assert.InRange(InGroup("london"), 5, 20);
        Assert.Superset(Venues.Where(v => v.Groups.Contains("london")).Select(v => v.Name).ToHashSet(),
            Venues.Where(v => v.Groups.Contains("london-and-nearby")).Select(v => v.Name).ToHashSet());
        Assert.InRange(InGroup("new-york"), 6, 20);
        Assert.InRange(InGroup("los-angeles"), 6, 20);
        // worldwide-busy fills 61 college games.
        Assert.InRange(InGroup("us-college"), 150, 400);
        Assert.All(Venues.Where(v => v.Groups.Contains("us-college")), v =>
            Assert.Contains(v.Leagues, l => l.League.StartsWith("NCAA", StringComparison.Ordinal)));
        // The venues only written-out games use are in no group a fill takes from.
        Assert.All(Venues.Where(v => v.Groups.Contains("written-out")), v => Assert.Equal(["written-out"], v.Groups));
    }

    [Fact]
    public void The_big_cities_have_room_for_crowded()
    {
        var bigCities = Venues.Where(v => v.Groups.Contains("big-cities")).ToList();

        // Crowded fills 40, and play needs free venues to bring new games on at.
        Assert.InRange(bigCities.Count, 50, 80);
        Assert.Superset(Venues.Where(v => v.Groups.Contains("london")).Select(v => v.Name).ToHashSet(),
            bigCities.Select(v => v.Name).ToHashSet());
    }

    [Fact]
    public void Every_venue_has_a_checked_in_lookup()
    {
        var lookups = JsonSerializer.Deserialize<Dictionary<string, Coordinates>>(
            File.ReadAllText(Path.Combine(ServerProjectFolder, "scenario-venue-locations.json")),
            new JsonSerializerOptions(JsonSerializerDefaults.Web))!;

        var missing = Venues.SelectMany(v => v.ToProviderVenues()).Select(VenueLocator.VenueQuery).Where(q => !lookups.ContainsKey(q));

        Assert.Empty(missing); // run scripts/lookup-scenario-venues.cs after changing scenario-venues.json
    }
}
