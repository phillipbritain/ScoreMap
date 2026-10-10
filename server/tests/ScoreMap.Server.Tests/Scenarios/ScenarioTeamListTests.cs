using System.Text.Json;
using ScoreMap.Server.Scenarios;

namespace ScoreMap.Server.Tests.Scenarios;

/// <summary>The team list that ships in the repo, which made-up games are between (ADR-0009).</summary>
public class ScenarioTeamListTests
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    // The team list by league name, as written.
    private static readonly Dictionary<string, List<ScenarioTeam>> Teams =
        JsonSerializer.Deserialize<Dictionary<string, List<ScenarioTeam>>>(
            File.ReadAllText(Path.Combine(ScenarioVenueListTests.ServerProjectFolder, "scenario-teams.json")), Json)!;

    // The leagues ScoreMap shows, from appsettings.json.
    private static readonly List<string> ConfiguredLeagues = JsonDocument
        .Parse(File.ReadAllText(Path.Combine(ScenarioVenueListTests.ServerProjectFolder, "appsettings.json")))
        .RootElement.GetProperty("Leagues").EnumerateArray()
        .Select(league => league.GetProperty("Name").GetString()!)
        .ToList();

    [Fact]
    public void Every_configured_league_has_its_teams_and_the_list_has_no_other_league()
    {
        Assert.Equal(ConfiguredLeagues.Order(), Teams.Keys.Order());
        Assert.All(Teams, league => Assert.True(league.Value.Count >= 12, $"{league.Key} has {league.Value.Count} teams"));
    }

    [Fact]
    public void Every_team_has_a_name_abbreviation_and_espn_logo_and_a_league_lists_each_team_once()
    {
        Assert.All(Teams, league =>
        {
            Assert.All(league.Value, team =>
            {
                Assert.False(string.IsNullOrWhiteSpace(team.Name), league.Key);
                Assert.False(string.IsNullOrWhiteSpace(team.Abbreviation), team.Name);
                Assert.StartsWith("https://a.espncdn.com/", team.LogoUrl);
            });
            Assert.Equal(league.Value.Count, league.Value.Select(team => team.Name).Distinct().Count());
        });
    }

    [Fact]
    public void There_are_teams_enough_for_a_game_at_every_worldwide_venue_at_once()
    {
        var worldwide = ScenarioVenue.ReadList(Path.Combine(ScenarioVenueListTests.ServerProjectFolder, "scenario-venues.json"))
            .Count(v => v.Groups.Contains("worldwide"));

        // Each league can hold half its teams' worth of games at once, as no team plays two at a time.
        Assert.True(Teams.Values.Sum(teams => teams.Count / 2) >= worldwide, $"room for a game at each of {worldwide} venues");
    }
}
