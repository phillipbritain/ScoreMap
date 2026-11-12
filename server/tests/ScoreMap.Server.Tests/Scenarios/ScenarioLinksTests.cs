using ScoreMap.Server.Games;
using ScoreMap.Server.Scenarios;
using ScoreMap.Server.Tests.Support;

namespace ScoreMap.Server.Tests.Scenarios;

/// <summary>Made-up ESPN and StreamEast links on a scenario's games, so the game panel's logos show without real games.</summary>
public class ScenarioLinksTests
{
    private static string Games(IEnumerable<string> ids) => $$"""
        {
          "games": [
            {{string.Join(",\n", ids.Select(id => $$"""
              {
                "id": "{{id}}",
                "league": "NFL",
                "home": { "name": "Kansas City Chiefs", "abbreviation": "KC", "score": 14 },
                "away": { "name": "Buffalo Bills", "abbreviation": "BUF", "score": 10 },
                "venue": { "name": "Arrowhead Stadium", "city": "Kansas City", "region": "MO", "country": "USA" },
                "startsIn": "-40m",
                "status": "live"
              }
            """))}}
          ]
        }
        """;

    [Fact]
    public void Some_games_have_both_links_some_one_and_some_neither()
    {
        var links = Enumerable.Range(0, 200).Select(i => ScenarioLinks.For($"game-{i}")).ToList();

        Assert.Contains(links, l => l is { EspnUrl: not null, Streams.Count: 1 });
        Assert.Contains(links, l => l is { EspnUrl: not null, Streams.Count: 0 });
        Assert.Contains(links, l => l is { EspnUrl: null, Streams.Count: 1 });
        Assert.Contains(links, l => l is { EspnUrl: null, Streams.Count: 0 });
    }

    [Fact]
    public void A_game_keeps_its_links_for_as_long_as_it_runs()
    {
        Assert.Equal(ScenarioLinks.For("game-7"), ScenarioLinks.For("game-7"));
    }

    [Fact]
    public async Task A_scenarios_games_are_sent_with_their_made_up_links()
    {
        var ids = Enumerable.Range(0, 8).Select(i => $"game-{i}").ToList();
        await using var server = new ScoreMapServer { Scenario = "links" };
        server.WriteScenario("links", Games(ids));
        await using var client = await server.ConnectClientAsync();

        foreach (var id in ids)
        {
            var sent = await client.GameMatchingAsync(g => g.Id == id);
            var links = ScenarioLinks.For(id);
            Assert.Equal(links.EspnUrl, sent.EspnUrl);
            Assert.Equal(links.Streams, sent.StreamLinks);
        }
    }
}
