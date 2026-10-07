using System.Net;
using System.Text;

namespace ScoreMap.Server.Tests.Support;

/// <summary>An HTTP handler that answers every request with a canned JSON body and records the requests.</summary>
public sealed class StubHttpHandler(Func<HttpRequestMessage, string?> respond) : HttpMessageHandler
{
    public List<HttpRequestMessage> Requests { get; } = [];

    public static StubHttpHandler Returning(string body) => new(_ => body);

    /// <summary>
    /// Answers each request with the body of the first entry whose key starts its URL, 404 Not Found
    /// when none does, and 500 for a body of <see cref="ServerError"/>.
    /// </summary>
    public static StubHttpHandler Serving(params (string UrlStart, string Body)[] bodies) =>
        new(request => bodies.FirstOrDefault(b => request.RequestUri!.AbsoluteUri.StartsWith(b.UrlStart, StringComparison.Ordinal)).Body);

    /// <summary>A body for <see cref="Serving"/> that makes the request fail with 500 Internal Server Error.</summary>
    public const string ServerError = "<500>";

    protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
    {
        lock (Requests)
            Requests.Add(request);
        return Task.FromResult(respond(request) switch
        {
            null => new HttpResponseMessage(HttpStatusCode.NotFound),
            ServerError => new HttpResponseMessage(HttpStatusCode.InternalServerError),
            var body => new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent(body, Encoding.UTF8, "application/json"),
            },
        });
    }
}
