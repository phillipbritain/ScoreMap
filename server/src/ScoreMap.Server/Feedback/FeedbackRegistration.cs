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
        services.AddSingleton<FeedbackGuard>();
        services.AddSingleton<IFeedbackSink>(sp =>
            string.IsNullOrWhiteSpace(sp.GetRequiredService<IOptions<FeedbackOptions>>().Value.GitHubToken)
                ? ActivatorUtilities.CreateInstance<LoggedFeedbackSink>(sp)
                : ActivatorUtilities.CreateInstance<GitHubFeedbackSink>(sp));
        return services;
    }
}
