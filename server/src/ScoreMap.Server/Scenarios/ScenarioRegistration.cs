using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Options;
using ScoreMap.Server.GameFeed;
using ScoreMap.Server.Games;
using ScoreMap.Server.Live;

namespace ScoreMap.Server.Scenarios;

public static class ScenarioRegistration
{
    /// <summary>
    /// In Development, puts a <see cref="ScenarioSwitcher"/> in front of the real game feed provider
    /// (ADR-0009), starting on the scenario named by the "Scenario" setting, or on real games when it is
    /// unset or "real", with the scenario clock at the speed named by the "ScenarioSpeed" setting (Normal when unset). The game
    /// board then takes the switcher's clock, so a scenario's pin windows and end times are on the
    /// scenario clock. Anywhere else nothing scenario-related is registered and the settings are ignored.
    /// Call after the real game feed provider and the game board are registered.
    /// </summary>
    public static WebApplicationBuilder AddScenarios(this WebApplicationBuilder builder)
    {
        if (!builder.Environment.IsDevelopment())
            return builder;
        var name = builder.Configuration["Scenario"];
        var startWith = string.IsNullOrWhiteSpace(name) ? ScenarioSwitcher.RealGames : name;
        var speedName = builder.Configuration["ScenarioSpeed"] is { Length: > 0 } setting ? setting : Speed.Normal.Name;
        var speed = Speed.Named(speedName) ?? throw new InvalidOperationException(
            $"The ScenarioSpeed setting is \"{speedName}\", which isn't a speed; it must be one of {Speed.List}");

        var services = builder.Services;
        services.Configure<ScenarioOptions>(builder.Configuration.GetSection("Scenarios"));
        // The real games' provider moves behind the switcher.
        var realGames = services.Last(d => d.ServiceType == typeof(IGameFeedProvider) && !d.IsKeyedService);
        services.Add(Keyed(realGames, ScenarioSwitcher.RealGamesKey));
        services.AddSingleton(sp => ActivatorUtilities.CreateInstance<ScenarioSwitcher>(sp, startWith, speed));
        services.Replace(ServiceDescriptor.Singleton<IGameFeedProvider>(sp => sp.GetRequiredService<ScenarioSwitcher>()));
        services.Replace(ServiceDescriptor.Singleton(sp => ActivatorUtilities.CreateInstance<GameBoard>(
            sp, sp.GetRequiredService<ScenarioSwitcher>().BoardClock)));
        // The poller starts at the intervals for what the switcher starts on: a scenario's, or the
        // configured ones for real games, which the switcher goes back to on a switch to them.
        services.Replace(ServiceDescriptor.Singleton(sp => ActivatorUtilities.CreateInstance<Poller>(
            sp, Options.Create(sp.GetRequiredService<ScenarioSwitcher>().Polling))));
        return builder;
    }

    private static ServiceDescriptor Keyed(ServiceDescriptor descriptor, object key) => descriptor switch
    {
        { ImplementationInstance: { } instance } => ServiceDescriptor.KeyedSingleton(descriptor.ServiceType, key, instance),
        { ImplementationFactory: { } factory } =>
            ServiceDescriptor.KeyedSingleton(descriptor.ServiceType, key, (sp, _) => factory(sp)),
        { ImplementationType: { } type } => ServiceDescriptor.KeyedSingleton(descriptor.ServiceType, key, type),
        _ => throw new InvalidOperationException($"Can't move {descriptor} behind the scenario switcher"),
    };
}
