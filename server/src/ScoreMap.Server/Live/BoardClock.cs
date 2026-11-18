namespace ScoreMap.Server.Live;

/// <summary>
/// A game board's clock, as browsers are sent it: it <see cref="Reads"/> this at the real time
/// <see cref="At"/>, and runs <see cref="Times"/> times as fast as real time from there (0 when paused).
/// The real time with real games; the scenario clock in a scenario or a demo (ADR-0009). Browsers read
/// it to tell which Upcoming games fill a globe with few games on (ADR-0029).
/// </summary>
public sealed record BoardClock(DateTimeOffset At, DateTimeOffset Reads, int Times);
