using Microsoft.AspNetCore.SignalR;
using ScoreMap.Server.Hubs;
using ScoreMap.Server.Live;

namespace ScoreMap.Server.Scenarios;

public static class ScenarioEndpoints
{
    /// <summary>
    /// What the browser's scenario pill, speed pill and clock show: the running scenario (or "real") and
    /// every scenario file, the speed and the speeds to choose from, and where the clock games are on
    /// is (the scenario clock, or the real time while real games run), for the browser to run forward.
    /// </summary>
    public sealed record ScenarioListing(
        string Running, IReadOnlyList<string> Scenarios, int Speed, IReadOnlyList<int> Speeds, ClockAnchor Clock);

    /// <summary>A switch: a scenario's name, or "real" for real games.</summary>
    public sealed record ScenarioSwitch(string? Name);

    /// <summary>A change of speed.</summary>
    public sealed record SpeedChange(int Speed);

    /// <summary>
    /// The scenario pill's and speed pill's endpoints (ADR-0009): the listing, a switch of the server's
    /// one source of games, and a change of the scenario clock's speed. Outside Development there is no
    /// switcher, so the server lists no scenarios and refuses a switch or a change of speed.
    /// </summary>
    public static WebApplication MapScenarios(this WebApplication app)
    {
        app.MapGet("/api/scenarios", (IServiceProvider services) =>
            services.GetService<ScenarioSwitcher>() is { } switcher
                ? Listing(switcher)
                : new ScenarioListing(ScenarioSwitcher.RealGames, [], 1, [], ClockAnchor.RealTime(services.GetRequiredService<TimeProvider>())));

        // Switches every browser: the change events take the old games away and bring the new ones.
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
                await poller.StartAfreshAsync(ThenPolling(switcher, () => switcher.SwitchTo(name)), cancellationToken);
            }
            catch (ScenarioFileException e)
            {
                return Results.Problem(e.Message, statusCode: StatusCodes.Status422UnprocessableEntity);
            }
            return Results.Ok(await TellEveryBrowserAsync(switcher, hub, cancellationToken));
        });

        // Carries on from where the running scenario is, at the new speed, in every browser.
        app.MapPut("/api/scenarios/speed", async (
            SpeedChange request, IServiceProvider services, Poller poller, IHubContext<GamesHub> hub,
            CancellationToken cancellationToken) =>
        {
            if (services.GetService<ScenarioSwitcher>() is not { } switcher)
                return Results.NotFound("Scenarios are only available when ScoreMap runs locally");
            if (!ScenarioClock.IsSpeed(request.Speed))
                return Results.BadRequest($"There is no speed {request.Speed}; it must be one of {ScenarioClock.SpeedList}");
            try
            {
                await poller.StartAfreshAsync(ThenPolling(switcher, () => switcher.ChangeSpeed(request.Speed)), cancellationToken);
            }
            catch (InvalidOperationException e)
            {
                return Results.Conflict(e.Message);
            }
            return Results.Ok(await TellEveryBrowserAsync(switcher, hub, cancellationToken));
        });
        return app;
    }

    /// <summary>
    /// A switch or a change of speed, then the polling intervals for what is running now: for the poller
    /// to make between its fetches, so none reads the old scenario on the new clock, and then fetch every
    /// league straight away at those intervals. A change that throws leaves everything as it was.
    /// </summary>
    private static Func<PollingOptions> ThenPolling(ScenarioSwitcher switcher, Action change) => () =>
    {
        change();
        return switcher.Polling;
    };

    /// <summary>Tells every browser the new listing, after a switch or a change of speed, so each one's pills and clock follow.</summary>
    private static async Task<ScenarioListing> TellEveryBrowserAsync(
        ScenarioSwitcher switcher, IHubContext<GamesHub> hub, CancellationToken cancellationToken)
    {
        var listing = Listing(switcher);
        await hub.Clients.All.SendAsync(GamesHub.ScenarioChangedMessage, listing, cancellationToken);
        return listing;
    }

    private static ScenarioListing Listing(ScenarioSwitcher switcher) =>
        new(switcher.Running, switcher.Scenarios, switcher.Speed, ScenarioClock.Speeds, switcher.Clock);
}
