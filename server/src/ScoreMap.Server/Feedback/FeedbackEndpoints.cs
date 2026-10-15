using ScoreMap.Server.Games;
using ScoreMap.Server.Scenarios;

namespace ScoreMap.Server.Feedback;

public static class FeedbackEndpoints
{
    /// <summary>
    /// Feedback from the Feedback button: the viewer's text, what they were looking at, and the
    /// honeypot <see cref="Website"/>, a field hidden from people that only a bot fills in.
    /// </summary>
    public sealed record FeedbackSubmission(string? Text, FeedbackContext? Context, string? Website = null);

    /// <summary>The answer: the filed issue's address, or a short error to show the viewer.</summary>
    public sealed record FeedbackReply(string? IssueUrl = null, string? Error = null);

    public const string ClosedForToday = "Feedback is closed for today, try tomorrow";

    /// <summary>
    /// Files feedback as an issue (through the <see cref="IFeedbackSink"/>), after the guards: its
    /// length, the visitor's and the day's limits (<see cref="FeedbackGuard"/>) and the honeypot.
    /// </summary>
    public static WebApplication MapFeedback(this WebApplication app)
    {
        app.MapPost("/api/feedback", async (
            FeedbackSubmission submission, HttpContext http, FeedbackGuard guard, IFeedbackSink sink, GameBoard board, DemoBoard demo,
            ILoggerFactory loggers, CancellationToken cancellationToken) =>
        {
            // A bot: thanked as a person would be, so it has no reason to try another way.
            if (!string.IsNullOrEmpty(submission.Website))
            {
                loggers.CreateLogger(typeof(FeedbackEndpoints)).LogInformation("Dropped feedback with the honeypot filled in");
                return Reply(StatusCodes.Status200OK, new FeedbackReply(IssueUrl: LoggedFeedbackSink.DummyIssueUrl.AbsoluteUri));
            }
            var text = submission.Text?.Trim() ?? "";
            if (text.Length < FeedbackIssue.MinLength)
                return Refused(StatusCodes.Status400BadRequest, $"Please write at least {FeedbackIssue.MinLength} characters");
            if (text.Length > FeedbackIssue.MaxLength)
                return Refused(StatusCodes.Status400BadRequest, $"Please keep it to {FeedbackIssue.MaxLength:N0} characters");
            // The day first, so once it's closed every submission is told so, and counts against no visitor.
            var visitor = http.Connection.RemoteIpAddress;
            if (!guard.TryTakeToday())
                return Refused(StatusCodes.Status429TooManyRequests, ClosedForToday);
            if (!guard.TrySend(visitor))
            {
                guard.GiveBackToday();
                return Refused(StatusCodes.Status429TooManyRequests, "That's a lot of feedback at once, try again in a few minutes");
            }

            var context = submission.Context ?? new FeedbackContext();
            var issue = FeedbackIssue.Write(text, context, http.Request.Headers.UserAgent.ToString(), board.Leagues,
                context.Demo ? demo.Games : board.Games);
            var filed = false;
            try
            {
                var url = await sink.FileAsync(issue, cancellationToken);
                filed = true;
                return Reply(StatusCodes.Status200OK, new FeedbackReply(IssueUrl: url.AbsoluteUri));
            }
            catch (FeedbackNotFiledException)
            {
                return Refused(StatusCodes.Status502BadGateway, "Couldn't send it just now, try again later");
            }
            finally
            {
                // Only filed issues count, towards the day and the visitor's limit, so a viewer can try again.
                if (!filed)
                {
                    guard.GiveBackToday();
                    guard.GiveBackSend(visitor);
                }
            }
        });
        return app;
    }

    private static IResult Refused(int status, string error) => Reply(status, new FeedbackReply(Error: error));

    private static IResult Reply(int status, FeedbackReply reply) => Results.Json(reply, statusCode: status);
}
