using ScoreMap.Server.Games;

namespace ScoreMap.Server.Scenarios;

/// <summary>
/// A scenario's play (<c>"play": true</c>, ADR-0009), which <see cref="ScenarioPlay"/> plays: its games
/// play like real games, at random. A game that has been Final or Disrupted a short while makes way
/// for a new one at a random venue from <see cref="Venues"/> (the group the scenario's <c>fill</c>
/// draws from), made by <see cref="Maker"/>. <see cref="DisruptedShare"/> is the share of the games
/// showing at any moment that play keeps Disrupted (<c>"disrupted"</c>). Play never disrupts the
/// games in <see cref="WrittenOut"/>, the ones the scenario file writes out one by one, so a game
/// written to show something (such as a close game coming into clutch time) goes on showing it.
/// </summary>
public sealed record PlaySettings(
    IReadOnlyList<League> Leagues, IReadOnlyList<ScenarioVenue> Venues, ScenarioGameMaker Maker, double DisruptedShare,
    IReadOnlySet<string> WrittenOut);
