namespace ScoreMap.Server.Feedback;

/// <summary>
/// Where feedback is filed: <see cref="GitHubFeedbackSink"/> with the owner's token, otherwise
/// <see cref="LoggedFeedbackSink"/>, so a local run or a test never posts to GitHub.
/// </summary>
public interface IFeedbackSink
{
    /// <summary>
    /// Files the issue and gives its address. Throws <see cref="FeedbackNotFiledException"/> when it
    /// couldn't be filed (GitHub refused it or didn't answer).
    /// </summary>
    Task<Uri> FileAsync(FeedbackIssue issue, CancellationToken cancellationToken);
}

/// <summary>Feedback that couldn't be filed: the viewer is told to try again, with their text kept.</summary>
public sealed class FeedbackNotFiledException(Exception inner) : Exception("The feedback couldn't be filed", inner);

/// <summary>The feedback sink with no token: it logs the issue it would have filed, and files nothing.</summary>
public sealed class LoggedFeedbackSink(ILogger<LoggedFeedbackSink> logger) : IFeedbackSink
{
    /// <summary>The link the viewer is thanked with, standing in for a filed issue's.</summary>
    public static readonly Uri DummyIssueUrl = new("https://github.com/phillipbritain/ScoreMap/issues");

    public Task<Uri> FileAsync(FeedbackIssue issue, CancellationToken cancellationToken)
    {
        logger.LogInformation("Feedback not posted (no GitHub token): would have filed \"{Title}\"\n{Body}", issue.Title, issue.Body);
        return Task.FromResult(DummyIssueUrl);
    }
}
