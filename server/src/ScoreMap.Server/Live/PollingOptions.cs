namespace ScoreMap.Server.Live;

/// <summary>How often the poller fetches each league, under "Polling". A scenario sets both to 1 s (ADR-0009).</summary>
public sealed class PollingOptions
{
    /// <summary>How often a league with Live games is fetched.</summary>
    public TimeSpan LiveInterval { get; set; } = TimeSpan.FromSeconds(15);

    /// <summary>How often a league without Live games is fetched.</summary>
    public TimeSpan QuietInterval { get; set; } = TimeSpan.FromMinutes(3);
}
