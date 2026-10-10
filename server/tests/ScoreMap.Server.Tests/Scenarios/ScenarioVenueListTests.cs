using System.Text.Json;
using ScoreMap.Server.GameFeed;
using ScoreMap.Server.Scenarios;
using ScoreMap.Server.Venues;

namespace ScoreMap.Server.Tests.Scenarios;

/// <summary>The venue list and checked-in lookups that ship in the repo (ADR-0009).</summary>
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

    [Fact]
    public void About_150_venues_across_every_continent_plus_more_around_london()
    {
        Assert.InRange(Venues.Count, 140, 200);
        Assert.Equal(Venues.Count, Venues.Select(v => VenueLocator.VenueQuery(v.ToProviderVenue())).Distinct().Count());
        // One country per inhabited continent, standing in for it.
        Assert.Superset(new HashSet<string> { "England", "USA", "Brazil", "South Africa", "Japan", "Australia" },
            Venues.Select(v => v.Country).ToHashSet());
    }

    [Fact]
    public void Every_venue_is_worldwide_in_a_big_city_or_near_london_and_the_dense_areas_have_groups_of_their_own()
    {
        Assert.All(Venues, v => Assert.True(
            v.Groups.Contains("worldwide") || v.Groups.Contains("big-cities") || v.Groups.Contains("london-and-nearby"), v.Name));
        int InGroup(string group) => Venues.Count(v => v.Groups.Contains(group));
        Assert.InRange(InGroup("worldwide"), 150, 200);
        // Spread across the world: London's own venues are in, the many around it are not.
        Assert.InRange(Venues.Count(v => v.Groups.Contains("worldwide") && v.Groups.Contains("london-and-nearby")),
            0, InGroup("worldwide") / 10);
        Assert.InRange(InGroup("london"), 12, 20);
        Assert.InRange(InGroup("london-and-nearby"), 40, 50);
        Assert.Superset(Venues.Where(v => v.Groups.Contains("london")).Select(v => v.Name).ToHashSet(),
            Venues.Where(v => v.Groups.Contains("london-and-nearby")).Select(v => v.Name).ToHashSet());
        Assert.InRange(InGroup("new-york"), 6, 20);
        Assert.InRange(InGroup("los-angeles"), 6, 20);
    }

    [Fact]
    public void The_big_cities_have_room_for_crowded_and_span_the_worlds_biggest_cities()
    {
        var bigCities = Venues.Where(v => v.Groups.Contains("big-cities")).ToList();

        // Crowded fills 40, and play needs free venues to bring new games on at.
        Assert.InRange(bigCities.Count, 50, 80);
        Assert.Superset(new HashSet<string> { "New York", "Los Angeles", "Miami", "London", "Paris", "Tokyo" },
            bigCities.Select(v => v.City).ToHashSet());
        Assert.Superset(Venues.Where(v => v.Groups.Contains("london")).Select(v => v.Name).ToHashSet(),
            bigCities.Select(v => v.Name).ToHashSet());
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
