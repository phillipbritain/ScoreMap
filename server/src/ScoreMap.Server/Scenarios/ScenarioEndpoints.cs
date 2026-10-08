using Microsoft.AspNetCore.SignalR;
using ScoreMap.Server.Hubs;
using ScoreMap.Server.Live;

namespace ScoreMap.Server.Scenarios;

public static class ScenarioEndpoints
{
    /// <summary>What the browser's scenario picker shows: the running scenario (or "real") and every scenario file.</summary>
    public sealed record ScenarioListing(string Running, IReadOnlyList<string> Scenarios);

    /// <summary>A switch: a scenario's name, or "real" for real games.</summary>
    public sealed record ScenarioSwitch(string? Name);

    /// <summary>
    /// The scenario picker's endpoints (ADR-0009): the listing, and a switch of the server's one
    /// source of games. Outside Development there is no switcher, so the server lists no scenarios
    /// and refuses a switch.
    /// </summary>
    public static WebApplication MapScenarios(this WebApplication app)
    {
        app.MapGet("/api/scenarios", (IServiceProvider services) =>
            services.GetService<ScenarioSwitcher>() is { } switcher
                ? Listing(switcher)
                : new ScenarioListing(ScenarioSwitcher.RealGames, []));

        // Switches every browser: the poller fetches every league from the new source straight away,
        // and the change events take the old games away and bring the new ones. Every browser is
        // told what is running now, so each one's pill follows.
        app.MapPut("/api/scenarios/running", async (
            ScenarioSwitch request, IServiceProvider services, Poller poller, IHubContext<GamesHub> hub,
            CancellationToken cancellationToken) =>
        {
            if (services.GetService<ScenarioSwitcher>() is not { } switcher)
                return Results.NotFound("Scenarios are only available when ScoreMap runs locally");
            if (request.Name is not { } name || !switcher.Has(name))
                return Results.NotFound($"There is no scenario \"{request.Name}\"");
            try
            {
                switcher.SwitchTo(name);
            }
            catch (ScenarioFileException e)
            {
                return Results.Problem(e.Message, statusCode: StatusCodes.Status422UnprocessableEntity);
            }
            await poller.StartAfreshAsync(switcher.Polling, cancellationToken);
            await hub.Clients.All.SendAsync(GamesHub.ScenarioSwitchedMessage, switcher.Running, cancellationToken);
            return Results.Ok(Listing(switcher));
        });
        return app;
    }

    private static ScenarioListing Listing(ScenarioSwitcher switcher) => new(switcher.Running, switcher.Scenarios);
}
