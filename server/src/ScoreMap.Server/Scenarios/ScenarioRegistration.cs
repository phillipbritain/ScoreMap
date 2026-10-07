using Microsoft.Extensions.DependencyInjection.Extensions;
using ScoreMap.Server.GameFeed;
using ScoreMap.Server.Live;

namespace ScoreMap.Server.Scenarios;

public static class ScenarioRegistration
{
    /// <summary>
    /// In Development, puts a <see cref="ScenarioSwitcher"/> in front of the real game feed provider
    /// (ADR-0009), starting on the scenario named by the "Scenario" setting, or on real games when it is
    /// unset or "real". Anywhere else nothing scenario-related is registered and the setting is ignored.
    /// Call after the real game feed provider is registered.
    /// </summary>
    public static WebApplicationBuilder AddScenarios(this WebApplicationBuilder builder)
    {
        if (!builder.Environment.IsDevelopment())
            return builder;
        var name = builder.Configuration["Scenario"];
        var startWith = string.IsNullOrWhiteSpace(name) ? ScenarioSwitcher.RealGames : name;

        var services = builder.Services;
        services.Configure<ScenarioOptions>(builder.Configuration.GetSection("Scenarios"));
        // The real games' provider moves behind the switcher.
        var realGames = services.Last(d => d.ServiceType == typeof(IGameFeedProvider) && !d.IsKeyedService);
        services.Add(Keyed(realGames, ScenarioSwitcher.RealGamesKey));
        services.AddSingleton(sp => ActivatorUtilities.CreateInstance<ScenarioSwitcher>(sp, startWith));
        services.Replace(ServiceDescriptor.Singleton<IGameFeedProvider>(sp => sp.GetRequiredService<ScenarioSwitcher>()));
        if (!startWith.Equals(ScenarioSwitcher.RealGames, StringComparison.OrdinalIgnoreCase))
            services.PostConfigure<PollingOptions>(polling =>
            {
                polling.LiveInterval = ScenarioSwitcher.ScenarioPolling.LiveInterval;
                polling.QuietInterval = ScenarioSwitcher.ScenarioPolling.QuietInterval;
            });
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
