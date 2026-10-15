using System.Net;
using System.Text;
using System.Text.Json;

namespace ScoreMap.Server.Tests.Support;

/// <summary>
/// A made-up GitHub issues API for the feedback sink: it files each issue it's sent as the next
/// number, or answers with an error, or never answers. Records every request. GitHub itself is never
/// contacted.
/// </summary>
public sealed class FakeGitHub : HttpMessageHandler
{
    /// <summary>An issue as it was sent: the request's address, its token and its JSON body.</summary>
    public sealed record FiledIssue(Uri Url, string? Authorization, string Title, string Body, IReadOnlyList<string> Labels);

    private readonly List<FiledIssue> _issues = [];
    private Func<CancellationToken, Task<HttpResponseMessage>>? _answer;
    private int _nextNumber = 300;

    public IReadOnlyList<FiledIssue> Issues
    {
        get { lock (_issues) return _issues.ToList(); }
    }

    /// <summary>GitHub files every issue again, as it does to start with.</summary>
    public void Answer() => _answer = null;

    /// <summary>GitHub answers every request with this status (a server error, a refusal).</summary>
    public void Fail(HttpStatusCode status) => _answer = _ => Task.FromResult(new HttpResponseMessage(status));

    /// <summary>GitHub never answers; the request only ends when the sink gives up on it.</summary>
    public void Hang() => _answer = async cancellationToken =>
    {
        await Task.Delay(Timeout.Infinite, cancellationToken);
        throw new InvalidOperationException("unreachable");
    };

    protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
    {
        var json = JsonDocument.Parse(await request.Content!.ReadAsStringAsync(cancellationToken)).RootElement;
        var issue = new FiledIssue(
            request.RequestUri!,
            request.Headers.Authorization?.ToString(),
            json.GetProperty("title").GetString()!,
            json.GetProperty("body").GetString()!,
            json.GetProperty("labels").EnumerateArray().Select(l => l.GetString()!).ToList());
        if (_answer is { } answer)
            return await answer(cancellationToken);
        int number;
        lock (_issues)
        {
            _issues.Add(issue);
            number = _nextNumber++;
        }
        var repository = request.RequestUri!.AbsolutePath.Split('/')[2..4];
        return new HttpResponseMessage(HttpStatusCode.Created)
        {
            Content = new StringContent(
                JsonSerializer.Serialize(new { number, html_url = $"https://github.com/{string.Join('/', repository)}/issues/{number}" }),
                Encoding.UTF8, "application/json"),
        };
    }
}
