namespace ScoreMap.Server.GameFeed;

/// <summary>
/// A game as a game feed provider reports it, in provider-neutral terms. Its <see cref="Contest"/> is who
/// competes and their scores (ADR-0020).
/// <see cref="Phase"/> says where play stands within <see cref="Period"/> while the game is under way.
/// The rest is extra detail for the game panel, each part null (or empty) when the provider gives none:
/// a note on the game, the crowd, the betting line, where play stands right now, the last score,
/// in soccer and rugby the scores and cards, and in tennis the games in each set and how a match ended early.
/// </summary>
public sealed record ProviderGame(
    string Id,
    string LeagueKey,
    DateTimeOffset StartTime,
    ProviderContest Contest,
    ProviderStatus Status,
    string? DisplayClock,
    int? Period,
    ProviderVenue? Venue,
    ProviderPeriodPhase Phase = ProviderPeriodPhase.Playing)
{
    /// <summary>
    /// What's special about the game, as the provider puts it: a playoff round ("NLDS - Game 2"), a game
    /// abroad ("NFL London Games"), a two-legged tie's outcome, a makeup date.
    /// </summary>
    public string? Note { get; init; }

    /// <summary>Where play stands right now; the provider only gives it while the game is under way.</summary>
    public ProviderSituation? Situation { get; init; }

    /// <summary>The last score: who scored and how, and when in the game.</summary>
    public ProviderScoringPlay? LastScore { get; init; }

    /// <summary>Soccer and rugby: the scores and cards so far, in the order they happened.</summary>
    public IReadOnlyList<ProviderKeyEvent> KeyEvents { get; init; } = [];

    /// <summary>
    /// Tennis: the games each side has won in each set so far, in order, the current set last. The
    /// sides' scores are their sets won, and <see cref="Period"/> is the current set. The home side
    /// is the one ESPN lists first (its <c>order</c> 1), shown on top.
    /// </summary>
    public IReadOnlyList<ProviderSet> Sets { get; init; } = [];

    /// <summary>Tennis: why a Final match ended before its sets were played out, and who advanced; null when it was played out.</summary>
    public ProviderEarlyEnding? EarlyEnding { get; init; }

    /// <summary>The game's page on ESPN's website (its summary or gamecast); null when ESPN lists none.</summary>
    public string? EspnUrl { get; init; }
}

/// <summary>
/// Who competes in a game, and their scores, in one of the shapes a game's score takes (ADR-0020): two
/// sides (<see cref="ProviderSides"/>), a field (<see cref="ProviderField"/>) or a fight card (<see cref="ProviderBouts"/>).
/// </summary>
public abstract record ProviderContest;

/// <summary>A game between two sides: the home side and the away side.</summary>
public sealed record ProviderSides(ProviderTeam Home, ProviderTeam Away) : ProviderContest;

/// <summary>
/// A game among a field, such as a race or a golf tournament: its entrants, ordered by position, the leader
/// first; none before the provider lists them. Entrants tied on score share a position. Two fields are equal
/// when their entrants are.
/// </summary>
public sealed record ProviderField(IReadOnlyList<ProviderEntrant> Entries) : ProviderContest
{
    public bool Equals(ProviderField? other) => other is not null && Entries.SequenceEqual(other.Entries);

    public override int GetHashCode() => Entries.Aggregate(0, HashCode.Combine);

    /// <summary>
    /// A field of these entrants in this order, positioned by it: each one level on score to par with the one
    /// before shares their position (two at -11 after the leader are both 2nd, the next 4th).
    /// </summary>
    public static ProviderField TiedByScore(IEnumerable<ProviderEntrant> inOrder)
    {
        var entries = new List<ProviderEntrant>();
        foreach (var entrant in inOrder)
        {
            var tied = entries.Count > 0 && entrant.ToPar is not null && entrant.ToPar == entries[^1].ToPar;
            entries.Add(entrant with { Position = tied ? entries[^1].Position : entries.Count + 1 });
        }
        return new ProviderField(entries);
    }
}

/// <summary>
/// One of a field: their position (1 for the leader), name, short name ("K. Larson") and their country's flag.
/// In golf, their score to par (-12; 0 is level) and the holes they've played of the current round
/// (<see cref="Thru"/>, 0 before they start it); both null in racing.
/// </summary>
public sealed record ProviderEntrant(int Position, string Name, string ShortName, string? FlagUrl, int? ToPar = null, int? Thru = null);

/// <summary>
/// A fight card: its bouts, the main event first (the reverse of the order they're fought in). Two fight
/// cards are equal when their bouts are.
/// </summary>
public sealed record ProviderBouts(IReadOnlyList<ProviderBout> Bouts) : ProviderContest
{
    public bool Equals(ProviderBouts? other) => other is not null && Bouts.SequenceEqual(other.Bouts);

    public override int GetHashCode() => Bouts.Aggregate(0, HashCode.Combine);

    /// <summary>The bout being fought now; null before the card starts, between bouts and once it's over.</summary>
    public ProviderBout? OnNow => Bouts.LastOrDefault(bout => bout.Status is ProviderStatus.InProgress or ProviderStatus.Delayed);

    /// <summary>
    /// The card's status, from its bouts': under way once any bout has started, and over once none is still to
    /// come or under way. One with no bout started takes <paramref name="calledOff"/> when that is Postponed or
    /// Canceled, so a card called off reads as one, and is otherwise still to come.
    /// </summary>
    public ProviderStatus Status(ProviderStatus calledOff = ProviderStatus.Scheduled)
    {
        if (!Bouts.Any(bout => bout.Status is ProviderStatus.InProgress or ProviderStatus.Delayed or ProviderStatus.Final))
            return calledOff is ProviderStatus.Postponed or ProviderStatus.Canceled ? calledOff : ProviderStatus.Scheduled;
        return Bouts.Any(bout => bout.Status is ProviderStatus.Scheduled or ProviderStatus.InProgress or ProviderStatus.Delayed)
            ? ProviderStatus.InProgress
            : ProviderStatus.Final;
    }
}

/// <summary>
/// One bout on a fight card: its two sides in the provider's order, its weight class ("Lightweight"), how
/// many rounds it's scheduled for, its status, the round it's in or ended in and the time into that round
/// (each null before it starts), and once it's over, how it was won (null for a draw or no contest, or
/// when the provider doesn't say).
/// </summary>
public sealed record ProviderBout(
    string Id,
    ProviderBoutSide First,
    ProviderBoutSide Second,
    string? WeightClass,
    int ScheduledRounds,
    ProviderStatus Status,
    int? Round = null,
    string? Clock = null,
    BoutMethod? Method = null);

/// <summary>
/// One of a bout's two sides: their name, short name ("R. Moicano"), their country's flag, their record
/// ("21-7-1": wins, losses and draws) and whether they won it.
/// </summary>
public sealed record ProviderBoutSide(string Name, string ShortName, string? FlagUrl, string? Record, bool Winner = false);

/// <summary>How a bout was won.</summary>
public enum BoutMethod
{
    /// <summary>A knockout or technical knockout, a doctor's or corner's stoppage among them.</summary>
    KnockOut,

    Submission,

    /// <summary>The judges' scorecards, after the scheduled rounds.</summary>
    Decision,
}

/// <summary>
/// A tennis set: the games each side won, in a tiebreak each side's tiebreak points (null otherwise), and
/// whether the home side won it (false: the away side did; null while it's played, or if it never finished).
/// </summary>
public sealed record ProviderSet(int Home, int Away, int? HomeTiebreak = null, int? AwayTiebreak = null, bool? HomeWon = null);

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
/// it: wins and losses ("5-2"), in soccer wins, draws and losses ("2-2-3"). <see cref="ConferenceId"/> is the
/// ESPN group id of its conference, in the college leagues that give one.
/// </summary>
public sealed record ProviderTeam(string Abbreviation, string FullName, string? LogoUrl, int? Score,
    ProviderCity? HomeCity = null, ProviderInnings? Innings = null, int? Rank = null, string? Record = null,
    string? ConferenceId = null);

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
/// The venue as the provider reports it. ESPN supplies no coordinates, so the venue locator places it,
/// unless it comes with its <see cref="Location"/> (an IndyCar race's, from the checked-in track list).
/// <see cref="Id"/> is the provider's own id for the venue, used to ask it for a photo.
/// In tennis, <see cref="Name"/> is the tournament, so all its matches share one spot, and
/// <see cref="Court"/> the court the match is on, when the provider has named it.
/// </summary>
public sealed record ProviderVenue(string? Name, string? City, string? Region, string? Country, string? Id = null,
    string? Court = null, Coordinates? Location = null);

public sealed record Coordinates(double Latitude, double Longitude);

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

/// <summary>A goal or card in soccer, or a score or card in rugby: what it was, the team (its abbreviation), the player and the minute ("23'").</summary>
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

    /// <summary>A break after the period: end of a quarter, halftime, an intermission, cricket's innings break or golf's night after a round.</summary>
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
