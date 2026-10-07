using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Options;
using ScoreMap.Server.GameFeed;
using ScoreMap.Server.Games;
using ScoreMap.Server.Live;

namespace ScoreMap.Server.Scenarios;

public static class ScenarioRegistration
{
    /// <summary>
    /// Runs the scenario named by the "Scenario" setting in place of real games (ADR-0009): its fake
    /// game feed provider replaces ESPN's. Only in Development; anywhere else, and with "Scenario"
    /// unset or "real", nothing scenario-related is registered and the setting is ignored.
    /// </summary>
    public static WebApplicationBuilder AddScenarios(this WebApplicationBuilder builder)
    {
        var name = builder.Configuration["Scenario"];
        if (!builder.Environment.IsDevelopment() || string.IsNullOrWhiteSpace(name)
            || name.Equals("real", StringComparison.OrdinalIgnoreCase))
            return builder;

        var services = builder.Services;
        services.Configure<ScenarioOptions>(builder.Configuration.GetSection("Scenarios"));
        services.AddSingleton(sp =>
        {
            var contentRoot = sp.GetRequiredService<IHostEnvironment>().ContentRootPath;
            var options = sp.GetRequiredService<IOptions<ScenarioOptions>>().Value;
            return ScenarioReader.Read(
                Path.Combine(contentRoot, options.Folder),
                name,
                sp.GetRequiredService<IOptions<List<League>>>().Value,
                ScenarioVenue.ReadList(Path.Combine(contentRoot, options.VenueListPath)));
        });
        services.AddSingleton<ScenarioGameFeedProvider>();
        services.Replace(ServiceDescriptor.Singleton<IGameFeedProvider>(sp => sp.GetRequiredService<ScenarioGameFeedProvider>()));
        // Every league every second, so scripted changes show up straight away.
        services.PostConfigure<PollingOptions>(polling =>
        {
            polling.LiveInterval = TimeSpan.FromSeconds(1);
            polling.QuietInterval = TimeSpan.FromSeconds(1);
        });
        return builder;
    }
}
