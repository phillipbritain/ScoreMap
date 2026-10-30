namespace ScoreMap.Server.GameFeed;

/// <summary>
/// A game as a game feed provider reports it, in provider-neutral terms.
/// <see cref="Phase"/> says where play stands within <see cref="Period"/> while the game is under way.
/// The rest is extra detail for the game panel, each part null (or empty) when the provider gives none:
/// a note on the game, the crowd, the betting line, where play stands right now, the last score,
/// in soccer the goals and cards, and in tennis the games in each set and how a match ended early.
/// </summary>
public sealed record ProviderGame(
    string Id,
    string LeagueKey,
    DateTimeOffset StartTime,
    ProviderTeam Home,
    ProviderTeam Away,
    ProviderStatus Status,
    string? DisplayClock,
    int? Period,
    ProviderVenue? Venue,
    IReadOnlyList<ProviderBroadcaster> Broadcasters,
    ProviderPeriodPhase Phase = ProviderPeriodPhase.Playing)
{
    /// <summary>
    /// What's special about the game, as the provider puts it: a playoff round ("NLDS - Game 2"), a game
    /// abroad ("NFL London Games"), a two-legged tie's outcome, a makeup date.
    /// </summary>
    public string? Note { get; init; }

    /// <summary>How many came to watch, once the provider reports it.</summary>
    public int? Attendance { get; init; }

    public ProviderOdds? Odds { get; init; }

    /// <summary>Where play stands right now; the provider only gives it while the game is under way.</summary>
    public ProviderSituation? Situation { get; init; }

    /// <summary>The last score: who scored and how, and when in the game.</summary>
    public ProviderScoringPlay? LastScore { get; init; }

    /// <summary>Soccer: the goals and cards so far, in the order they happened.</summary>
    public IReadOnlyList<ProviderKeyEvent> KeyEvents { get; init; } = [];

    /// <summary>
    /// Tennis: the games each side has won in each set so far, in order, the current set last. The
    /// sides' scores are their sets won, and <see cref="Period"/> is the current set. <see cref="Home"/>
    /// is the side ESPN lists first (its <c>order</c> 1), shown on top.
    /// </summary>
    public IReadOnlyList<ProviderSet> Sets { get; init; } = [];

    /// <summary>Tennis: why a Final match ended before its sets were played out, and who advanced; null when it was played out.</summary>
    public ProviderEarlyEnding? EarlyEnding { get; init; }
}

/// <summary>
/// A tennis set: the games each side won, and in a tiebreak each side's tiebreak points (null otherwise).
/// </summary>
public sealed record ProviderSet(int Home, int Away, int? HomeTiebreak = null, int? AwayTiebreak = null);

/// <summary>
/// How a tennis match ended early: its <see cref="Reason"/>, and the side that advanced (its abbreviation),
/// the winner whatever the score when it stopped; null if the provider doesn't say.
/// </summary>
public sealed record ProviderEarlyEnding(EarlyEndingReason Reason, string? Winner);

public enum EarlyEndingReason
{
    /// <summary>A side stopped partway through, injured or ill.</summary>
    Retired,

    /// <summary>A side withdrew before the match began.</summary>
    Walkover,
}

/// <summary>
/// A team in a game. <see cref="HomeCity"/> is the city the team plays its home games in, when the
/// provider knows it; the venue locator falls back to it for a home team's game with no venue. In
/// cricket, <see cref="Score"/> is the team's runs and <see cref="Innings"/> the rest of its innings;
/// it's null in every other sport, and in cricket before the team bats. <see cref="Rank"/> is its place
/// in its league's poll (college sports), and <see cref="Record"/> its season so far as its sport writes
/// it: wins and losses ("5-2"), in soccer wins, draws and losses ("2-2-3").
/// </summary>
public sealed record ProviderTeam(string Abbreviation, string FullName, string? LogoUrl, int? Score,
    ProviderCity? HomeCity = null, ProviderInnings? Innings = null, int? Rank = null, string? Record = null);

/// <summary>
/// A cricket team's innings beyond its runs. <see cref="Wickets"/> is null when the side is all out, as
/// the provider writes its score then ("127", not "127/10"). The side batting, or last to bat, also has
/// the <see cref="Overs"/> bowled to it as cricket writes them ("13.2": 13 overs and 2 balls), the most
/// it may face, and in the second innings the <see cref="Target"/> it is chasing.
/// </summary>
public sealed record ProviderInnings(int? Wickets, string? Overs = null, int? OverLimit = null, int? Target = null);

/// <summary>A city as the provider names it, e.g. ("Charlotte", "NC", "USA").</summary>
public sealed record ProviderCity(string Name, string? Region, string? Country);

/// <summary>
/// The venue as the provider reports it. It carries no coordinates (ESPN supplies none); the venue
/// locator places it. <see cref="Id"/> is the provider's own id for the venue, used to ask it for a photo.
/// In tennis, <see cref="Name"/> is the tournament, so all its matches share one spot, and
/// <see cref="Court"/> the court the match is on, when the provider has named it.
/// </summary>
public sealed record ProviderVenue(string? Name, string? City, string? Region, string? Country, string? Id = null,
    string? Court = null);

public sealed record Coordinates(double Latitude, double Longitude);

public sealed record ProviderBroadcaster(string Name, string? Country);

/// <summary>
/// The betting line: <see cref="Line"/> as the bookmaker writes it (the favourite and its spread,
/// "SEA -2.5", or "EVEN"), the total points it expects (<see cref="OverUnder"/>), and the bookmaker.
/// </summary>
public sealed record ProviderOdds(string? Line, double? OverUnder, string? Bookmaker);

/// <summary>
/// Where play stands right now, in the terms of the game's sport, each part null when it doesn't apply:
/// the last play described; in football the down and distance ("3rd & 7 at DEN 34") and the team with
/// the ball (its abbreviation); in baseball the count, the outs and which bases have runners on.
/// </summary>
public sealed record ProviderSituation(
    string? LastPlay,
    string? DownAndDistance = null,
    string? Possession = null,
    int? Balls = null,
    int? Strikes = null,
    int? Outs = null,
    bool OnFirst = false,
    bool OnSecond = false,
    bool OnThird = false);

/// <summary>
/// A score: the team that scored (its abbreviation), what happened, as the provider describes it
/// ("Rashee Rice 2 Yd pass from Patrick Mahomes"), and when: the period, the clock as the sport
/// shows it (null in baseball, which has none), and in baseball which half of the inning.
/// </summary>
public sealed record ProviderScoringPlay(
    string Team, string Text, int? Period, string? Clock, ProviderPeriodPhase Phase = ProviderPeriodPhase.Playing);

/// <summary>A goal or card in soccer: what it was, the team (its abbreviation), the player and the minute ("23'").</summary>
public sealed record ProviderKeyEvent(KeyEventKind Kind, string Team, string? Player, string? Clock);

public enum ProviderStatus
{
    Scheduled,
    InProgress,
    Delayed,
    Final,
    Postponed,
    Suspended,
    Canceled,
}

/// <summary>Where play stands within the current period (quarter, half, period, inning or innings).</summary>
public enum ProviderPeriodPhase
{
    /// <summary>The period is being played (or the game hasn't started or has finished).</summary>
    Playing,

    /// <summary>A break after the period: end of a quarter, halftime, an intermission or cricket's innings break.</summary>
    Break,

    /// <summary>A shootout (hockey) or penalty shootout (soccer).</summary>
    Shootout,

    /// <summary>Baseball: the visiting team is batting.</summary>
    InningTop,

    /// <summary>Baseball: between the top and bottom of the inning.</summary>
    InningMiddle,

    /// <summary>Baseball: the home team is batting.</summary>
    InningBottom,

    /// <summary>Baseball: the inning is over.</summary>
    InningEnd,
}
