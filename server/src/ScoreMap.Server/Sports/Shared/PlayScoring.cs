using ScoreMap.Server.GameFeed;
using ScoreMap.Server.Games;
using ScoreMap.Server.Scenarios;

namespace ScoreMap.Server.Sports.Shared;

/// <summary>Frequency, weighted increments, cap and tie settlement for made-up two-sided games.</summary>
internal sealed record PlayScoring(double PerGame, (int Points, double Chance)[] Points, int Most, int? Settling);

/// <summary>A weighted stretch of play or a break within a game's planned length.</summary>
internal sealed record PlaySegment(int Period, ProviderPeriodPhase Phase, double Weight, bool Playing);
