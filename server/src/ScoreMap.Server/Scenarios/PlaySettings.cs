using ScoreMap.Server.Games;

namespace ScoreMap.Server.Scenarios;

/// <summary>
/// A scenario's play (<c>"play": true</c>, ADR-0009), which <see cref="ScenarioPlay"/> plays: its games
/// play like real games, at random. A game that has been Final a short while makes way for a new one
/// at a random venue from <see cref="Venues"/> (the group the scenario's <c>fill</c> draws from), made
/// by <see cref="Maker"/>.
/// </summary>
public sealed record PlaySettings(IReadOnlyList<League> Leagues, IReadOnlyList<ScenarioVenue> Venues, ScenarioGameMaker Maker);
