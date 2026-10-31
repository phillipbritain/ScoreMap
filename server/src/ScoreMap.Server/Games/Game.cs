using System.Text.Json.Serialization;
using ScoreMap.Server.GameFeed;

namespace ScoreMap.Server.Games;

/// <summary>
/// A game as ScoreMap sends it to browsers. Serialized camelCase over SignalR;
/// mirrored by <c>web/src/games/game.ts</c>. Its <see cref="Contest"/> is who competes and their scores
/// (ADR-0020). <see cref="ClutchTime"/> says whether a basketball game is in
/// clutch time (see <see cref="Games.ClutchTime"/>); it's false in every other sport. <see cref="Hot"/> says
/// whether the game is hot (see <see cref="HotGame"/>), by its sport's rule. The rest is extra detail for
/// the game panel, each part null (or empty) when the feed gives none.
/// </summary>
public sealed record Game(
    string Id,
    string League,
    string Sport,
    DateTimeOffset StartTime,
    GameStatus Status,
    bool Delayed,
    Disruption? Disruption,
    DateTimeOffset? EndTime,
    GameContest Contest,
    string? Clock,
    int? Period,
    bool ClutchTime,
    bool Hot,
    GameVenue Venue,
    IReadOnlyList<GameBroadcaster> Broadcasters,
    IReadOnlyList<StreamLink> StreamLinks)
{
    /// <summary>
    /// What's special about the game, as the feed puts it: a playoff round ("NLDS - Game 2"), a game abroad
    /// ("NFL London Games"), a two-legged tie's outcome.
    /// </summary>
    public string? Note { get; init; }

    /// <summary>How many came to watch, once the feed reports it.</summary>
    public int? Attendance { get; init; }

    public GameOdds? Odds { get; init; }

    /// <summary>Where play stands right now; only while the game is Live.</summary>
    public GameSituation? Situation { get; init; }

    /// <summary>The last score: who scored and how, and when in the game.</summary>
    public ScoringPlay? LastScore { get; init; }

    /// <summary>Soccer: the goals and cards so far, in the order they happened.</summary>
    public IReadOnlyList<KeyEvent> KeyEvents { get; init; } = [];

    /// <summary>Whether ESPN lists the game in its Top Events: the games it picks as the most important right now.</summary>
    public bool TopEvent { get; init; }

    /// <summary>Tennis: the score set by set, with tiebreaks; null in other sports and before play.</summary>
    public GameScoreline? Scoreline { get; init; }
}

/// <summary>
/// Who competes in a game, and their scores, in one of the shapes a game's score takes (ADR-0020), told
/// apart in JSON by its <c>kind</c>. Its only shape so far is two sides, <see cref="GameSides"/>.
/// </summary>
[JsonPolymorphic(TypeDiscriminatorPropertyName = "kind")]
[JsonDerivedType(typeof(GameSides), "sides")]
public abstract record GameContest;

/// <summary>A game between two sides: the home side and the away side.</summary>
public sealed record GameSides(GameTeam Home, GameTeam Away) : GameContest;

/// <summary>
/// A tennis match's score set by set (see <see cref="GameSet"/>). A match ended early has its
/// <see cref="Ending"/> ("ret." or "W/O") and the side that <see cref="Advanced"/> (its abbreviation),
/// when the feed says.
/// </summary>
public sealed record GameScoreline(IReadOnlyList<GameSet> Sets, string? Ending, string? Advanced);

/// <summary>
/// A tennis set: its <see cref="Name"/> ("1st"), its <see cref="Score"/> in games with the loser's
/// tiebreak points after a tiebreak ("7-6(5)"), and its <see cref="Winner"/> (their abbreviation). A won
/// set's score has the winner's games first; a set still being played has no winner, and its score has
/// the home side's games first, as it's shown on top.
/// </summary>
public sealed record GameSet(string Name, string Score, string? Winner);

/// <summary>
/// A team in a game, or in tennis a player: their short name ("J. Sinner") is the abbreviation and their
/// country's flag the logo. <see cref="Score"/> is text, as its sport writes it: points, goals or runs
/// ("24"), in cricket runs and wickets ("186/6"), runs alone when the side is all out, and in tennis sets
/// won; null before it scores anything (before the game starts, or in cricket before the team bats). <see cref="Rank"/> is its place
/// in its league's poll (college sports), and <see cref="Record"/> its season so far ("5-2"; in soccer
/// wins, draws and losses, "2-2-3"); each null where the feed gives none.
/// </summary>
public sealed record GameTeam(string Abbreviation, string FullName, string? LogoUrl, string? Score,
    int? Rank = null, string? Record = null);

/// <summary>
/// Where a game is played. <see cref="Region"/> is its state, province or the like, spelled out in full
/// for a US state or Canadian province ("Arizona", "Ontario"), as the feed gives it otherwise, and null
/// where the feed gives none. <see cref="TimeZone"/> is the venue's IANA time zone (e.g. "America/Chicago"),
/// or null when the venue could not be placed. <see cref="Photo"/> is null until a photo of the venue
/// has been found, and stays null for a venue that has none. In tennis, <see cref="Name"/> is the
/// tournament and <see cref="City"/> its city as the feed writes it ("Shanghai, China PR").
/// </summary>
public sealed record GameVenue(string? Name, string? City, string? Region, string? Country, double Latitude, double Longitude, string? TimeZone,
    VenuePhoto? Photo = null)
{
    /// <summary>Tennis: the court the match is on ("Stadium Court"), when the feed names it.</summary>
    public string? Court { get; init; }
}

/// <summary>
/// A photo of a venue for the top of the game panel: from outside or of the playing area, whichever
/// its source gives. <see cref="Credit"/> is set when the photo's licence asks for attribution
/// (Wikimedia Commons photos); ESPN's photos have none.
/// </summary>
public sealed record VenuePhoto(string Url, PhotoCredit? Credit);

/// <summary>
/// Who took a photo and under what licence, shown under it. <see cref="SourceUrl"/> is the photo's
/// own page, where its full licence terms are.
/// </summary>
public sealed record PhotoCredit(string Author, string Licence, string? LicenceUrl, string SourceUrl);

/// <summary>
/// A channel or streaming service showing a game, the country it broadcasts to when known,
/// and its official watch link when the owner has listed one.
/// </summary>
public sealed record GameBroadcaster(string Name, string? Country, string? WatchUrl);

/// <summary>
/// The betting line: <see cref="Line"/> as the bookmaker writes it ("SEA -2.5", "EVEN"), the total
/// points it expects (<see cref="OverUnder"/>), and the bookmaker.
/// </summary>
public sealed record GameOdds(string? Line, double? OverUnder, string? Bookmaker);

/// <summary>
/// Where play stands in a Live game, each part null (or false) where it doesn't apply: the last play
/// described; in football the down and distance ("3rd & 7 at DEN 34") and the team with the ball; in
/// baseball the count, the outs and which bases have runners on.
/// </summary>
public sealed record GameSituation(
    string? LastPlay,
    string? DownAndDistance,
    string? Possession,
    int? Balls,
    int? Strikes,
    int? Outs,
    bool OnFirst,
    bool OnSecond,
    bool OnThird);

/// <summary>
/// A score: the team that scored (its abbreviation), what happened ("Rashee Rice 2 Yd pass from Patrick
/// Mahomes"), and when, in the style of the clock line ("Q1 5:58", "Top 7th", "23'").
/// </summary>
public sealed record ScoringPlay(string Team, string Text, string? When);

/// <summary>A goal or card in soccer: what it was, the team (its abbreviation), the player and the minute ("23'").</summary>
public sealed record KeyEvent(KeyEventKind Kind, string Team, string? Player, string? Clock);

/// <summary>
/// An unofficial stream for a game, found by the stream finder on one of the owner's
/// configured sites (ADR-0002: hobby v1 only).
/// </summary>
public sealed record StreamLink(string Site, string Url);
