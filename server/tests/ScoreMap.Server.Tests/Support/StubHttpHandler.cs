using System.Net;
using System.Text;

namespace ScoreMap.Server.Tests.Support;

/// <summary>An HTTP handler that answers every request with a canned JSON body and records the requests.</summary>
public sealed class StubHttpHandler(Func<HttpRequestMessage, string> respond) : HttpMessageHandler
{
    public List<HttpRequestMessage> Requests { get; } = [];

    public static StubHttpHandler Returning(string body) => new(_ => body);

    protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
    {
        lock (Requests)
            Requests.Add(request);
        return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = new StringContent(respond(request), Encoding.UTF8, "application/json"),
        });
    }
}
