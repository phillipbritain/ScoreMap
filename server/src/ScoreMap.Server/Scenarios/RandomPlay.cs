using ScoreMap.Server.Games;

namespace ScoreMap.Server.Scenarios;

/// <summary>
/// A scenario's <c>"play": "random"</c> (ADR-0009): its Live games play out by themselves, and a
/// game that has been Final a short while makes way for a new one at a random venue from
/// <see cref="Venues"/> (the group the scenario's <c>fill</c> draws from), made by <see cref="Maker"/>.
/// <see cref="RandomPlayGames"/> plays it.
/// </summary>
public sealed record RandomPlay(IReadOnlyList<League> Leagues, IReadOnlyList<ScenarioVenue> Venues, ScenarioGameMaker Maker);
