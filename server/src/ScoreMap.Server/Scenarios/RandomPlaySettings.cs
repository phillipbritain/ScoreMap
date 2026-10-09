using ScoreMap.Server.Games;

namespace ScoreMap.Server.Scenarios;

/// <summary>
/// A scenario's play (ADR-0009), which <see cref="RandomPlay"/> plays: its Live games play out by
/// themselves, at random. Under <see cref="PlayKind.Random"/> a game that has been Final a short
/// while makes way for a new one at a random venue from <see cref="Venues"/> (the group the
/// scenario's <c>fill</c> draws from), made by <see cref="Maker"/>. Under <see cref="PlayKind.Live"/>
/// no game changes status, comes or goes, so neither is needed.
/// </summary>
public sealed record RandomPlaySettings(
    PlayKind Kind, IReadOnlyList<League> Leagues, IReadOnlyList<ScenarioVenue> Venues, ScenarioGameMaker? Maker);

/// <summary>The kinds of play a scenario file can ask for with <c>"play"</c>.</summary>
public enum PlayKind
{
    /// <summary>
    /// <c>"random"</c>: Live games score, move on, go to breaks and finish; Upcoming games start; Final
    /// games drop out and new games take their place.
    /// </summary>
    Random,

    /// <summary>
    /// <c>"live"</c>: Live games score and move on, but every game keeps its status, so the scenario keeps
    /// its mix. A Live game at the end of its last period starts over as a new game rather than finishing.
    /// </summary>
    Live,
}
