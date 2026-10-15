namespace ScoreMap.Server.Feedback;

/// <summary>
/// Where feedback from the Feedback button goes, under "Feedback" in configuration. With no token, as
/// on local runs and in tests, the server only logs the issues it would have filed.
/// </summary>
public sealed class FeedbackOptions
{
    /// <summary>
    /// The owner's fine-grained GitHub token, able only to write this repo's issues. Set in production
    /// from the App Service setting <c>Feedback__GitHubToken</c>; never sent to a browser.
    /// </summary>
    public string? GitHubToken { get; set; }

    /// <summary>The repo feedback is filed in, as <c>owner/name</c>.</summary>
    public string Repository { get; set; } = "phillipbritain/ScoreMap";

    /// <summary>How long GitHub gets to file an issue before the viewer is told it couldn't be sent.</summary>
    public double TimeoutSeconds { get; set; } = 10;
}
