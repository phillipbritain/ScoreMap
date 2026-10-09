using Microsoft.AspNetCore.SignalR;
using ScoreMap.Server.Hubs;
using ScoreMap.Server.Live;

namespace ScoreMap.Server.Scenarios;

public static class ScenarioEndpoints
{
    /// <summary>
    /// What the browser's scenario pill, media keys and clock show: the running scenario (or "real") and
    /// every scenario file, the speed (by name) and the speeds there are, and where the clock games are on
    /// is (the scenario clock, or the real time while real games run), for the browser to run forward.
    /// </summary>
    public sealed record ScenarioListing(
        string Running, IReadOnlyList<string> Scenarios, string Speed, IReadOnlyList<Speed> Speeds, ClockAnchor Clock);

    /// <summary>A switch: a scenario's name, or "real" for real games.</summary>
    public sealed record ScenarioSwitch(string? Name);

    /// <summary>A change of speed: the new speed's name.</summary>
    public sealed record SpeedChange(string? Speed);

    /// <summary>
    /// The scenario pill's and media keys' endpoints (ADR-0009): the listing, a switch of the server's
    /// one source of games, and a change of the scenario clock's speed. Outside Development there is no
    /// switcher, so the server lists no scenarios and refuses a switch or a change of speed.
    /// </summary>
    public static WebApplication MapScenarios(this WebApplication app)
    {
        app.MapGet("/api/scenarios", (IServiceProvider services) =>
            services.GetService<ScenarioSwitcher>() is { } switcher
                ? Listing(switcher)
                : new ScenarioListing(ScenarioSwitcher.RealGames, [], Speed.Normal.Name, [], ClockAnchor.RealTime(services.GetRequiredService<TimeProvider>())));

        // Switches every browser's games, in order:
        // 1. Under the poller's lock, between its fetches, the switcher starts the new source and hands
        //    back its polling intervals. Outside the lock a fetch could read the old scenario on the new
        //    scenario clock, and its games would come out wrong (#53).
        // 2. The poller, woken, fetches every league straight away on its own loop; the change events it
        //    sends take the old games away and bring the new ones.
        // 3. Meanwhile (the switch doesn't wait for that fetch), every browser gets the new listing, so
        //    each one's scenario pill, media keys and clock follow.
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
                await poller.StartAfreshAsync(() => switcher.SwitchTo(name), cancellationToken);
            }
            catch (ScenarioFileException e)
            {
                return Results.Problem(e.Message, statusCode: StatusCodes.Status422UnprocessableEntity);
            }
            return Results.Ok(await TellEveryBrowserAsync(switcher, hub, cancellationToken));
        });

        // Carries on from where the running scenario is, at the new speed, in every browser: in the same
        // order as a switch, and under the poller's lock for the same reason.
        app.MapPut("/api/scenarios/speed", async (
            SpeedChange request, IServiceProvider services, Poller poller, IHubContext<GamesHub> hub,
            CancellationToken cancellationToken) =>
        {
            if (services.GetService<ScenarioSwitcher>() is not { } switcher)
                return Results.NotFound("Scenarios are only available when ScoreMap runs locally");
            if (Speed.Named(request.Speed) is not { } speed)
                return Results.BadRequest($"There is no speed \"{request.Speed}\"; it must be one of {Speed.List}");
            try
            {
                await poller.StartAfreshAsync(() => switcher.ChangeSpeed(speed), cancellationToken);
            }
            catch (InvalidOperationException e)
            {
                return Results.Conflict(e.Message);
            }
            return Results.Ok(await TellEveryBrowserAsync(switcher, hub, cancellationToken));
        });
        return app;
    }

    /// <summary>Tells every browser the new listing, after a switch or a change of speed, so each one's pill, media keys and clock follow.</summary>
    private static async Task<ScenarioListing> TellEveryBrowserAsync(
        ScenarioSwitcher switcher, IHubContext<GamesHub> hub, CancellationToken cancellationToken)
    {
        var listing = Listing(switcher);
        await hub.Clients.All.SendAsync(GamesHub.ScenarioChangedMessage, listing, cancellationToken);
        return listing;
    }

    private static ScenarioListing Listing(ScenarioSwitcher switcher) =>
        new(switcher.Running, switcher.Scenarios, switcher.Speed.Name, Speed.All, switcher.Clock);
}
