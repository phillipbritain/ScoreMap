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

public sealed record GamePeriodScore(string Label, string? Home, string? Away);
public sealed record GameScoringPlay(string Team, string Text, string? When, int? HomeScore, int? AwayScore);
public sealed record GameDrive(string Team, string? Outcome, bool Scored, int? Plays, int? Yards, string? Duration, string? Start, string? End);
public sealed record GameStatTeam(string Team, IReadOnlyList<GameStatSection> Sections);
public sealed record GameStatSection(string Name, IReadOnlyList<string> Columns, IReadOnlyList<GameStatPlayer> Players);
public sealed record GameStatPlayer(string Name, IReadOnlyList<string> Values);
public sealed record GameVideo(string Title, string Url, int? Duration);
