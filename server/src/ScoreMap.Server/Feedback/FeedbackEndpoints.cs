namespace ScoreMap.Server.Feedback;

public static class FeedbackEndpoints
{
    /// <summary>The answer: the filed issue's address, or a short error to show the viewer.</summary>
    public sealed record FeedbackReply(string? IssueUrl = null, string? Error = null);

    /// <summary>Translates a Feedback filing result to the viewer's HTTP reply.</summary>
    public static WebApplication MapFeedback(this WebApplication app)
    {
        app.MapPost("/api/feedback", async (
            FeedbackSubmission submission, HttpContext http, FeedbackFiling filing, CancellationToken cancellationToken) =>
        {
            var result = await filing.FileAsync(submission, http.Connection.RemoteIpAddress,
                http.Request.Headers.UserAgent.ToString(), cancellationToken);
            var status = result.Outcome switch
            {
                FeedbackOutcome.Filed => StatusCodes.Status200OK,
                FeedbackOutcome.Invalid => StatusCodes.Status400BadRequest,
                FeedbackOutcome.DayFull or FeedbackOutcome.VisitorFull => StatusCodes.Status429TooManyRequests,
                FeedbackOutcome.NotFiled => StatusCodes.Status502BadGateway,
                _ => throw new InvalidOperationException("Unknown feedback outcome"),
            };
            return Results.Json(new FeedbackReply(result.IssueUrl, result.Error), statusCode: status);
        });
        return app;
    }
}
