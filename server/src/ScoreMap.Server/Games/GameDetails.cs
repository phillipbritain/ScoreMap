namespace ScoreMap.Server.Games;

/// <summary>Details for one selected game, served separately from the live scoreboard.</summary>
public sealed record GameDetails(
    IReadOnlyList<GamePeriodScore> PeriodScores,
    string? HomeTotal,
    string? AwayTotal,
    IReadOnlyList<GameScoringPlay> Scoring,
    IReadOnlyList<GameDrive> Drives,
    IReadOnlyList<GameStatTeam> Stats,
    IReadOnlyList<GameVideo> Videos,
    IReadOnlyList<string> Broadcasts)
{
    public static GameDetails Empty { get; } = new([], null, null, [], [], [], [], []);
}

public sealed record GamePeriodScore(string Label, string? Home, string? Away)
{
    /// <summary>
    /// The heading for a line score's <paramref name="period"/> (from 1) in <paramref name="league"/>: an
    /// inning's number, "P2", "H1" or "Q3", then "OT", "OT2" and so on past regulation.
    /// </summary>
    public static string LabelFor(League league, int period) => league.Sport switch
    {
        Sport.Baseball => period.ToString(System.Globalization.CultureInfo.InvariantCulture),
        _ when period > league.Regulation => period == league.Regulation + 1 ? "OT" : $"OT{period - league.Regulation}",
        Sport.Hockey => $"P{period}",
        Sport.Basketball when league.Regulation == 2 => $"H{period}",
        _ => $"Q{period}",
    };
}
public sealed record GameScoringPlay(string Team, string Text, string? When, int? HomeScore, int? AwayScore);
public sealed record GameDrive(string Team, string? Outcome, bool Scored, int? Plays, int? Yards, string? Duration, string? Start, string? End);
public sealed record GameStatTeam(string Team, IReadOnlyList<GameStatSection> Sections);
public sealed record GameStatSection(string Name, IReadOnlyList<string> Columns, IReadOnlyList<GameStatPlayer> Players);
public sealed record GameStatPlayer(string Name, IReadOnlyList<string> Values);
public sealed record GameVideo(string Title, string Url, int? Duration, DateTimeOffset? PublishedAt = null,
    string? ThumbnailUrl = null, VideoPlayback? Playback = null);

public sealed record VideoPlayback(string Kind, string Url);
