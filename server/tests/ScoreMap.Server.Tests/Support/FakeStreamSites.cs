using System.Net;
using System.Text;

namespace ScoreMap.Server.Tests.Support;

/// <summary>
/// Made-up stream sites for the unofficial stream finder, answering by host: a canned
/// search page, an error, or no answer at all. Records every request. No real site is ever
/// contacted.
/// </summary>
public sealed class FakeStreamSites : HttpMessageHandler
{
    private readonly Dictionary<string, Func<CancellationToken, Task<HttpResponseMessage>>> _sites = new();
    private readonly List<Uri> _requests = [];

    public IReadOnlyList<Uri> Requests
    {
        get { lock (_requests) return _requests.ToList(); }
    }

    /// <summary>Waits (in real time, briefly) until the sites have had at least <paramref name="count"/> requests.</summary>
    public async Task WaitForRequestsAsync(int count)
    {
        var deadline = DateTime.UtcNow.AddSeconds(10);
        while (Requests.Count < count)
        {
            if (DateTime.UtcNow > deadline)
                throw new TimeoutException($"{Requests.Count} stream site requests, expected {count}");
            await Task.Delay(10);
        }
    }

    /// <summary>The site answers every search with this HTML page.</summary>
    public void Serve(string host, string html) => Set(host, _ => Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK)
    {
        Content = new StringContent(html, Encoding.UTF8, "text/html"),
    }));

    /// <summary>The site answers every search with a server error.</summary>
    public void Fail(string host) => Set(host, _ => Task.FromResult(new HttpResponseMessage(HttpStatusCode.InternalServerError)));

    /// <summary>The site never answers; the request only ends when the finder gives up on it.</summary>
    public void Hang(string host) => Set(host, async cancellationToken =>
    {
        await Task.Delay(Timeout.Infinite, cancellationToken);
        throw new InvalidOperationException("unreachable");
    });

    private void Set(string host, Func<CancellationToken, Task<HttpResponseMessage>> answer)
    {
        lock (_sites)
            _sites[host] = answer;
    }

    protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
    {
        Func<CancellationToken, Task<HttpResponseMessage>>? answer;
        lock (_requests)
            _requests.Add(request.RequestUri!);
        lock (_sites)
            _sites.TryGetValue(request.RequestUri!.Host, out answer);
        return answer is null
            ? Task.FromException<HttpResponseMessage>(new HttpRequestException($"No such host: {request.RequestUri.Host}"))
            : answer(cancellationToken);
    }
}
