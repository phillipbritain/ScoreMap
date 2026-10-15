using System.Net.Http.Headers;
using System.Net.Http.Json;
using Microsoft.Extensions.Options;

namespace ScoreMap.Server.Feedback;

/// <summary>Files feedback as an issue in the repo through GitHub's REST API, with the owner's token.</summary>
public sealed class GitHubFeedbackSink(
    IHttpClientFactory httpClients, IOptions<FeedbackOptions> options, ILogger<GitHubFeedbackSink> logger) : IFeedbackSink
{
    public const string HttpClientName = "GitHub";

    /// <summary>Every feedback issue's labels: waiting for the owner to triage, and sent from the Feedback button.</summary>
    public static readonly IReadOnlyList<string> Labels = ["needs-triage", "feedback"];

    private sealed record CreatedIssue(string? Html_url);

    public async Task<Uri> FileAsync(FeedbackIssue issue, CancellationToken cancellationToken)
    {
        var settings = options.Value;
        using var timeout = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        timeout.CancelAfter(TimeSpan.FromSeconds(settings.TimeoutSeconds));
        using var request = new HttpRequestMessage(HttpMethod.Post, $"https://api.github.com/repos/{settings.Repository}/issues")
        {
            Content = JsonContent.Create(new { title = issue.Title, body = issue.Body, labels = Labels }),
        };
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", settings.GitHubToken);
        request.Headers.Accept.ParseAdd("application/vnd.github+json");
        request.Headers.Add("X-GitHub-Api-Version", "2022-11-28");
        request.Headers.UserAgent.ParseAdd("ScoreMap");
        try
        {
            using var response = await httpClients.CreateClient(HttpClientName).SendAsync(request, timeout.Token);
            response.EnsureSuccessStatusCode();
            var created = await response.Content.ReadFromJsonAsync<CreatedIssue>(timeout.Token);
            return new Uri(created?.Html_url ?? throw new InvalidOperationException("GitHub gave no address for the issue"));
        }
        catch (Exception e) when (!cancellationToken.IsCancellationRequested)
        {
            // A refusal (a token gone stale, a label missing) or no answer: the owner should know.
            logger.LogError(e, "GitHub didn't file feedback \"{Title}\"", issue.Title);
            throw new FeedbackNotFiledException(e);
        }
    }
}
