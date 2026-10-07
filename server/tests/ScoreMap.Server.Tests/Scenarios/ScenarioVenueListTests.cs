using System.Text.Json;
using ScoreMap.Server.GameFeed;
using ScoreMap.Server.Scenarios;
using ScoreMap.Server.Venues;

namespace ScoreMap.Server.Tests.Scenarios;

/// <summary>The venue list and checked-in lookups that ship in the repo (ADR-0009).</summary>
public class ScenarioVenueListTests
{
    private static readonly string ServerProjectFolder = Path.Combine(FindServerFolder(), "src", "ScoreMap.Server");

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

    [Fact]
    public void About_150_venues_across_every_continent()
    {
        Assert.InRange(Venues.Count, 140, 170);
        Assert.Equal(Venues.Count, Venues.Select(v => VenueLocator.VenueQuery(v.ToProviderVenue())).Distinct().Count());
        // One country per inhabited continent, standing in for it.
        Assert.Superset(new HashSet<string> { "England", "USA", "Brazil", "South Africa", "Japan", "Australia" },
            Venues.Select(v => v.Country).ToHashSet());
    }

    [Fact]
    public void Every_venue_is_worldwide_and_the_dense_areas_have_groups_of_their_own()
    {
        Assert.All(Venues, v => Assert.Contains("worldwide", v.Groups));
        int InGroup(string group) => Venues.Count(v => v.Groups.Contains(group));
        Assert.InRange(InGroup("london"), 12, 20);
        Assert.InRange(InGroup("new-york"), 6, 20);
        Assert.InRange(InGroup("los-angeles"), 6, 20);
    }

    [Fact]
    public void Every_venue_has_its_home_team()
    {
        Assert.All(Venues, v =>
        {
            Assert.False(string.IsNullOrWhiteSpace(v.HomeTeam.Name), v.Name);
            Assert.False(string.IsNullOrWhiteSpace(v.HomeTeam.Abbreviation), v.Name);
            Assert.StartsWith("https://a.espncdn.com/", v.HomeTeam.LogoUrl);
        });
    }

    [Fact]
    public void Every_venue_has_a_checked_in_lookup()
    {
        var lookups = JsonSerializer.Deserialize<Dictionary<string, Coordinates>>(
            File.ReadAllText(Path.Combine(ServerProjectFolder, "scenario-venue-locations.json")),
            new JsonSerializerOptions(JsonSerializerDefaults.Web))!;

        var missing = Venues.Select(v => VenueLocator.VenueQuery(v.ToProviderVenue())).Where(q => !lookups.ContainsKey(q));

        Assert.Empty(missing); // run scripts/lookup-scenario-venues.cs after changing scenario-venues.json
    }
}
