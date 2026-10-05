using System.Net;

namespace ScoreMap.Server.WatchLinks;

public static class StreamFinderRegistration
{
    /// <summary>
    /// Adds the unofficial stream finder (ADR-0002: hobby v1 only) as the server's
    /// <see cref="IStreamLinkSource"/>. It is off while the owner's site list in
    /// "StreamFinder:Sites" is empty, as it ships.
    /// </summary>
    public static IServiceCollection AddStreamFinder(this IServiceCollection services, IConfiguration configuration)
    {
        services.Configure<StreamFinderOptions>(configuration.GetSection("StreamFinder"));
        services.AddHttpClient(StreamFinder.HttpClientName, client =>
        {
            client.DefaultRequestHeaders.UserAgent.ParseAdd("Mozilla/5.0 (compatible; ScoreMap hobby app)");
        }).ConfigurePrimaryHttpMessageHandler(() => new SocketsHttpHandler
        {
            AutomaticDecompression = DecompressionMethods.All,
            PooledConnectionLifetime = TimeSpan.FromMinutes(5),
        });
        services.AddSingleton<StreamFinder>();
        services.AddSingleton<IStreamLinkSource>(sp => sp.GetRequiredService<StreamFinder>());
        return services;
    }
}
