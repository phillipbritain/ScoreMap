using ScoreMap.Server.GameFeed;

namespace ScoreMap.Server.Scenarios;

/// <summary>
/// Play for a game between two sides, which can also make one up part way through or finished, as
/// <see cref="ScenarioGameMaker"/> does for any league the team list supplies.
/// </summary>
internal abstract class SidesPlay : GamePlay
{
    /// <summary>A made-up Live game <paramref name="through"/> its planned length: its score, period, clock and phase.</summary>
    internal abstract MadeUp Live(ProviderTeam home, ProviderTeam away, double through, Random random);

    /// <summary>A made-up Final game: a whole game's score, settled where its sport has no draws.</summary>
    internal abstract MadeUp Final(ProviderTeam home, ProviderTeam away, Random random);
}

/// <summary>A made-up game's two sides and where it stands.</summary>
internal readonly record struct MadeUp(ProviderTeam Home, ProviderTeam Away, int Period, string? Clock, ProviderPeriodPhase Phase);
