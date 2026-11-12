using ScoreMap.Server.Games;
using ScoreMap.Server.WatchLinks;

namespace ScoreMap.Server.Scenarios;

/// <summary>
/// A scenario game's made-up links, for the game panel's ESPN and StreamEast logos (ADR-0009): picked by
/// its id, so a game keeps them while it runs, about a quarter of games having both, a quarter only an ESPN
/// page, a quarter only a StreamEast stream and a quarter neither. Each goes to its site's home page, as the
/// games aren't real.
/// </summary>
internal sealed record ScenarioLinks(string? EspnUrl, IReadOnlyList<StreamLink> Streams)
{
    private const string EspnHome = "https://www.espn.com/";

    private static readonly IReadOnlyList<StreamLink> OneStream = [new("StreamEast", "https://streameast.cool/")];

    public static ScenarioLinks For(string gameId) => ((uint)Scenario.StableSeed($"links\u0001{gameId}") % 4) switch
    {
        0 => new(EspnHome, OneStream),
        1 => new(EspnHome, []),
        2 => new(null, OneStream),
        _ => new(null, []),
    };
}

/// <summary>
/// The stream link source while a scenario runs: its games' made-up StreamEast links (see
/// <see cref="ScenarioLinks"/>); on real games, the real source's.
/// </summary>
internal sealed class ScenarioStreamLinks(IStreamLinkSource real, ScenarioSwitcher switcher) : IStreamLinkSource
{
    public IReadOnlyList<StreamLink> LinksFor(Game game) =>
        switcher.RunningRealGames ? real.LinksFor(game) : ScenarioLinks.For(game.Id).Streams;
}
