using ScoreMap.Server.Games;

namespace ScoreMap.Server.Scenarios;

/// <summary>
/// A scenario's play (<c>"play": true</c>, ADR-0009), which <see cref="RandomPlay"/> plays: its games
/// play like real games, at random. A game that has been Final or Disrupted a short while makes way
/// for a new one at a random venue from <see cref="Venues"/> (the group the scenario's <c>fill</c>
/// draws from), made by <see cref="Maker"/>. <see cref="DisruptedShare"/> is the share of the games
/// showing at any moment that play keeps Disrupted (<c>"disrupted"</c>).
/// </summary>
public sealed record RandomPlaySettings(
    IReadOnlyList<League> Leagues, IReadOnlyList<ScenarioVenue> Venues, ScenarioGameMaker Maker, double DisruptedShare);
