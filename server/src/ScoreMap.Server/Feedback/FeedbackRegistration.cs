using Microsoft.Extensions.Options;

namespace ScoreMap.Server.Feedback;

public static class FeedbackRegistration
{
    /// <summary>
    /// Adds feedback from the Feedback button: filed on GitHub when "Feedback:GitHubToken" is set,
    /// otherwise only logged.
    /// </summary>
    public static IServiceCollection AddFeedback(this IServiceCollection services, IConfiguration configuration)
    {
        services.Configure<FeedbackOptions>(configuration.GetSection("Feedback"));
        services.AddHttpClient(GitHubFeedbackSink.HttpClientName);
        services.AddSingleton<FeedbackFiling>();
        services.AddSingleton<IFeedbackSink>(sp =>
            string.IsNullOrWhiteSpace(sp.GetRequiredService<IOptions<FeedbackOptions>>().Value.GitHubToken)
                ? ActivatorUtilities.CreateInstance<LoggedFeedbackSink>(sp)
                : ActivatorUtilities.CreateInstance<GitHubFeedbackSink>(sp));
        services.AddHostedService<NoFeedbackTokenWarning>();
        return services;
    }
}

/// <summary>
/// Warns at startup when production has no token, so feedback being only logged shows up in the logs
/// rather than going unnoticed (docs/configuration.md#feedback).
/// </summary>
internal sealed class NoFeedbackTokenWarning(
    IHostEnvironment environment, IOptions<FeedbackOptions> options, ILogger<NoFeedbackTokenWarning> logger) : IHostedService
{
    public Task StartAsync(CancellationToken cancellationToken)
    {
        if (environment.IsProduction() && string.IsNullOrWhiteSpace(options.Value.GitHubToken))
            logger.LogWarning("No Feedback:GitHubToken: feedback is only logged, not filed as issues");
        return Task.CompletedTask;
    }

    public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;
}
