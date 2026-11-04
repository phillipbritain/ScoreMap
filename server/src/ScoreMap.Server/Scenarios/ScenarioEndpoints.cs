using Microsoft.AspNetCore.SignalR;
using ScoreMap.Server.Hubs;
using ScoreMap.Server.Live;

namespace ScoreMap.Server.Scenarios;

public static class ScenarioEndpoints
{
    /// <summary>
    /// What the browser's scenario pill, media keys and clock show: the running scenario (or "real") and
    /// every scenario file, the speed (by name) and the speeds there are, whether play can be controlled
    /// (the browser hides the media keys and clock where it can't), and where the clock games are on is
    /// (the scenario clock, or the real time while real games run), for the browser to run forward, and
    /// whether the running scenario holds back each browser's first games (the browser that switches to
    /// it reloads, to start slowly).
    /// </summary>
    public sealed record ScenarioListing(
        string Running, IReadOnlyList<string> Scenarios, string Speed, IReadOnlyList<Speed> Speeds, bool CanControlPlay,
        ClockAnchor Clock, bool StartsSlowly = false);

    /// <summary>
    /// A switch: a scenario's name, or "real" for real games, and the speed to start it at (the speed it
    /// has, if left out): "Paused" starts it standing still at its start.
    /// </summary>
    public sealed record ScenarioSwitch(string? Name, string? Speed = null);

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
                : new ScenarioListing(ScenarioSwitcher.RealGames, [], Speed.Normal.Name, [], CanControlPlay: false, ClockAnchor.RealTime(services.GetRequiredService<TimeProvider>())));

        // The running board owns cancellation, source/clock changes and fresh delivery. The listing
        // is sent immediately; switching does not wait for any external fetch.
        app.MapPut("/api/scenarios/running", async (
            ScenarioSwitch request, IServiceProvider services, RunningGameBoard board, IHubContext<GamesHub> hub,
            CancellationToken cancellationToken) =>
        {
            if (services.GetService<ScenarioSwitcher>() is not { } switcher)
                return Results.NotFound("Scenarios are only available when ScoreMap runs locally");
            if (request.Name is not { } name || !switcher.Has(name))
                return Results.NotFound($"There is no scenario \"{request.Name}\"");
            Speed? speed = null;
            if (request.Speed is not null && (speed = Speed.Named(request.Speed)) is null)
                return NoSuchSpeed(request.Speed);
            try
            {
                await board.StartAfreshAsync(name, speed, cancellationToken);
            }
            catch (ScenarioFileException e)
            {
                return Results.Problem(e.Message, statusCode: StatusCodes.Status422UnprocessableEntity);
            }
            return Results.Ok(await TellEveryBrowserAsync(switcher, hub, cancellationToken));
        });

        // Carries on from the current scenario time at the new speed, in every browser.
        app.MapPut("/api/scenarios/speed", async (
            SpeedChange request, IServiceProvider services, RunningGameBoard board, IHubContext<GamesHub> hub,
            CancellationToken cancellationToken) =>
        {
            if (services.GetService<ScenarioSwitcher>() is not { } switcher)
                return Results.NotFound("Scenarios are only available when ScoreMap runs locally");
            if (Speed.Named(request.Speed) is not { } speed)
                return NoSuchSpeed(request.Speed);
            try
            {
                await board.ChangeSpeedAsync(speed, cancellationToken);
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
        await hub.Clients.Group(GamesHub.RealGamesGroup).SendAsync(GamesHub.ScenarioChangedMessage, listing, cancellationToken);
        return listing;
    }

    private static ScenarioListing Listing(ScenarioSwitcher switcher) =>
        new(switcher.Running, switcher.Scenarios, switcher.Speed.Name, Speed.All, switcher.CanControlPlay, switcher.Clock,
            StartsSlowly: switcher.SlowStart > TimeSpan.Zero);

    /// <summary>A switch's or a change of speed's refusal of a speed that isn't one of <see cref="Speed.All"/>.</summary>
    private static IResult NoSuchSpeed(string? speed) =>
        Results.BadRequest($"There is no speed \"{speed}\"; it must be one of {Speed.List}");
}
