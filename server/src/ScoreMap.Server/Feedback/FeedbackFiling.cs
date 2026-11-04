using System.Net;
using System.Security.Cryptography;
using ScoreMap.Server.Live;
using ScoreMap.Server.Scenarios;

namespace ScoreMap.Server.Feedback;

public sealed record FeedbackSubmission(string? Text, FeedbackContext? Context, string? Website = null);

public enum FeedbackOutcome { Filed, Invalid, DayFull, VisitorFull, NotFiled }

public sealed record FeedbackResult(FeedbackOutcome Outcome, string? IssueUrl = null, string? Error = null);

/// <summary>
/// Owns feedback from validation through issue preparation and filing. Only filed issues count
/// towards the allowances; a failed submission returns exactly the day and send it reserved.
/// </summary>
public sealed class FeedbackFiling(
    TimeProvider clock, IFeedbackSink sink, RunningGameBoard board, DemoBoard demo, ILogger<FeedbackFiling> logger)
{
    public const int PerVisitorLimit = 3;
    public static readonly TimeSpan PerVisitorWindow = TimeSpan.FromMinutes(10);
    public const int DailyCap = 20;
    public const string ClosedForToday = "Feedback is closed for today, try tomorrow";

    // A fresh key per server run; only keyed hashes are kept, never visitors' addresses.
    private readonly byte[] _key = RandomNumberGenerator.GetBytes(32);
    private readonly object _gate = new();
    private readonly Dictionary<string, LinkedList<DateTimeOffset>> _sends = new();
    private DateOnly _today;
    private int _filedToday;

    // The node identifies this send even when concurrent submissions have the same timestamp.
    private sealed record Reservation(DateOnly Day, string Visitor, LinkedListNode<DateTimeOffset> Send);

    public async Task<FeedbackResult> FileAsync(
        FeedbackSubmission submission, IPAddress? visitor, string? userAgent, CancellationToken cancellationToken)
    {
        // A bot is thanked as a person would be, so it has no reason to try another way.
        if (!string.IsNullOrEmpty(submission.Website))
        {
            logger.LogInformation("Dropped feedback with the honeypot filled in");
            return new(FeedbackOutcome.Filed, IssueUrl: LoggedFeedbackSink.DummyIssueUrl.AbsoluteUri);
        }
        var text = submission.Text?.Trim() ?? "";
        if (text.Length < FeedbackIssue.MinLength)
            return new(FeedbackOutcome.Invalid, Error: $"Please write at least {FeedbackIssue.MinLength} characters");
        if (text.Length > FeedbackIssue.MaxLength)
            return new(FeedbackOutcome.Invalid, Error: $"Please keep it to {FeedbackIssue.MaxLength:N0} characters");
        var (reservation, refusal) = Reserve(visitor);
        if (reservation is null)
            return refusal!;
        var filed = false;
        try
        {
            var context = submission.Context ?? new FeedbackContext();
            var issue = FeedbackIssue.Write(text, context, userAgent, board.Leagues,
                context.Demo ? demo.Games : board.Games);
            var url = await sink.FileAsync(issue, cancellationToken);
            filed = true;
            return new(FeedbackOutcome.Filed, IssueUrl: url.AbsoluteUri);
        }
        catch (FeedbackNotFiledException)
        {
            return new(FeedbackOutcome.NotFiled, Error: "Couldn't send it just now, try again later");
        }
        finally
        {
            if (!filed)
                Refund(reservation);
        }
    }

    private (Reservation? Reservation, FeedbackResult? Refusal) Reserve(IPAddress? visitor)
    {
        var key = Convert.ToHexString(HMACSHA256.HashData(_key, (visitor ?? IPAddress.None).GetAddressBytes()));
        lock (_gate)
        {
            var now = clock.GetUtcNow();
            var today = DateOnly.FromDateTime(now.UtcDateTime);
            if (today != _today)
                (_today, _filedToday) = (today, 0);
            // The day first: once closed, every visitor hears that and consumes no allowance.
            if (_filedToday >= DailyCap)
                return (null, new(FeedbackOutcome.DayFull, Error: ClosedForToday));
            foreach (var (other, times) in _sends.ToList())
            {
                while (times.First is { } first && now - first.Value >= PerVisitorWindow)
                    times.RemoveFirst();
                if (times.Count == 0)
                    _sends.Remove(other);
            }
            if (!_sends.TryGetValue(key, out var sends))
                _sends[key] = sends = new LinkedList<DateTimeOffset>();
            if (sends.Count >= PerVisitorLimit)
                return (null, new(FeedbackOutcome.VisitorFull, Error: "That's a lot of feedback at once, try again in a few minutes"));
            _filedToday++;
            return (new(today, key, sends.AddLast(now)), null);
        }
    }

    private void Refund(Reservation reservation)
    {
        lock (_gate)
        {
            if (reservation.Day == _today)
                _filedToday--;
            // Expired sends may already have been removed, including the visitor's entire list.
            if (reservation.Send.List is { } sends)
            {
                sends.Remove(reservation.Send);
                if (sends.Count == 0)
                    _sends.Remove(reservation.Visitor);
            }
        }
    }
}
