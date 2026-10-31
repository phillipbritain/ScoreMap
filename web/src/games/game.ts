// A game as the server sends it over SignalR.
// Mirrors server/src/ScoreMap.Server/Games/Game.cs (ADR-0003: shapes are defined on both sides).

/** A team in a game, or in tennis a player: their short name ("J. Sinner") as the abbreviation, their country's flag as the logo. */
export interface GameTeam {
  abbreviation: string
  fullName: string
  logoUrl: string | null
  /** As its sport writes it: "24", in cricket "186/6" (runs alone when all out), in tennis sets won; null before it scores anything. */
  score: string | null
  /** Its place in its league's poll (college sports); null when unranked or there's no poll. */
  rank: number | null
  /** Its season so far: "5-2", in soccer wins, draws and losses ("2-2-3"); null where the feed gives none. */
  record: string | null
}

export interface GameVenue {
  /** In tennis, the tournament ("Rolex Shanghai Masters"). */
  name: string | null
  city: string | null
  /** Its state, province or the like: in full for a US state or Canadian province ("Arizona"), as the feed gives it otherwise; null when there's none. */
  region: string | null
  country: string | null
  latitude: number
  longitude: number
  /** The venue's IANA time zone, e.g. "America/Chicago"; null when the venue could not be placed. */
  timeZone: string | null
  /** A photo of the venue (from outside or of the playing area); null until the server finds one, and for venues with none. */
  photo: VenuePhoto | null
  /** Tennis: the court the match is on ("Stadium Court"); null in other sports, or until the feed names it. */
  court: string | null
}

/** A photo of a venue, for the top of the game panel. */
export interface VenuePhoto {
  url: string
  /** Set when the photo's licence asks for attribution (Wikimedia Commons photos). */
  credit: PhotoCredit | null
}

/** Who took a photo and under what licence. */
export interface PhotoCredit {
  author: string
  licence: string
  licenceUrl: string | null
  /** The photo's own page, with its full licence terms. */
  sourceUrl: string
}

/** A channel or streaming service showing a game. */
export interface GameBroadcaster {
  name: string
  /** The country it broadcasts to (ISO 3166 alpha-2, e.g. "US"), when known. */
  country: string | null
  /** The service's official watch page, when the server's watch links file lists it. */
  watchUrl: string | null
}

/** An unofficial stream for a game, found by the server's stream finder (ADR-0002: hobby v1 only). */
export interface StreamLink {
  /** The owner's name for the site the link was found on. */
  site: string
  url: string
}

/** The betting line: the favourite and its spread as the bookmaker writes it ("SEA -2.5"), and the total points it expects. */
export interface GameOdds {
  line: string | null
  overUnder: number | null
  bookmaker: string | null
}

/**
 * Where play stands in a Live game, each part null (or false) where it doesn't apply: the last play
 * described; in football the down and distance ("3rd & 7 at DEN 34") and the team with the ball (its
 * abbreviation); in baseball the count, the outs and which bases have runners on.
 */
export interface GameSituation {
  lastPlay: string | null
  downAndDistance: string | null
  possession: string | null
  balls: number | null
  strikes: number | null
  outs: number | null
  onFirst: boolean
  onSecond: boolean
  onThird: boolean
}

/** A score: the team that scored (its abbreviation), what happened, and when, as the clock line writes it ("Q1 5:58", "Top 7th", "23'"). */
export interface ScoringPlay {
  team: string
  text: string
  when: string | null
}

/** What a soccer key event was. */
export type KeyEventKind = 'Goal' | 'PenaltyGoal' | 'OwnGoal' | 'YellowCard' | 'RedCard'

/** A goal or card in soccer: the team (its abbreviation), the player and the minute ("23'"). */
export interface KeyEvent {
  kind: KeyEventKind
  team: string
  player: string | null
  clock: string | null
}

/**
 * Who competes in a game, and their scores, in one of the shapes a game's score takes (ADR-0020), told
 * apart by its kind. Its only shape so far is two sides.
 */
export type GameContest = GameSides

/** A game between two sides: the home side and the away side. */
export interface GameSides {
  kind: 'sides'
  home: GameTeam
  away: GameTeam
}

/** A game's status in ScoreMap's terms (see GLOSSARY.md). */
export type GameStatus = 'Upcoming' | 'Live' | 'Final' | 'Disrupted'

/** Which kind of disruption made a game Disrupted. */
export type Disruption = 'Postponed' | 'Suspended' | 'Canceled'

export interface Game {
  id: string
  league: string
  sport: string
  /** ISO 8601 instant. */
  startTime: string
  status: GameStatus
  /** A Live game paused by a delay, such as a rain delay. */
  delayed: boolean
  /** Set only when the game is Disrupted. */
  disruption: Disruption | null
  /** ISO 8601 instant; set once the game is Final. */
  endTime: string | null
  /** Who competes and their scores (ADR-0020). */
  contest: GameContest
  clock: string | null
  period: number | null
  /**
   * In basketball, whether the game is in clutch time (see GLOSSARY.md): the last 5 minutes of the
   * last period of regulation, or any time in overtime, within 5 points. False in other sports.
   */
  clutchTime: boolean
  /**
   * Whether the game is hot (see GLOSSARY.md): Live, the trailing side one score from tying or taking
   * the lead, with little left to play, by its sport's rule (the server's HotGame). It shows flames, if
   * the viewer has them on.
   */
  hot: boolean
  venue: GameVenue
  broadcasters: GameBroadcaster[]
  /** Unofficial stream links; empty when the stream finder found none or is switched off. */
  streamLinks: StreamLink[]
  /** What's special about the game, as the feed puts it: a playoff round ("NLDS - Game 2"), a game abroad ("NFL London Games"). */
  note: string | null
  /** How many came to watch, once the feed reports it. */
  attendance: number | null
  odds: GameOdds | null
  /** Where play stands right now; only while the game is Live. */
  situation: GameSituation | null
  /** The last score; null before anyone scores, and in cricket. */
  lastScore: ScoringPlay | null
  /** Soccer: the goals and cards so far, in the order they happened; empty in other sports. */
  keyEvents: KeyEvent[]
  /** Whether ESPN lists the game in its Top Events: the games it picks as the most important right now. */
  topEvent: boolean
  /** Tennis: the score set by set; null in other sports and before play. */
  scoreline: GameScoreline | null
}

/**
 * A tennis match's score set by set. A match ended early has its ending ("ret." or "W/O") and the side
 * that advanced (its abbreviation), when the feed says.
 */
export interface GameScoreline {
  sets: GameSet[]
  ending: string | null
  advanced: string | null
}

/**
 * A tennis set: its name ("1st"), its score in games with the loser's tiebreak points after a tiebreak
 * ("7-6(5)"), and its winner (their abbreviation). A won set's score has the winner's games first; a set
 * still being played has no winner, and its score has the top side's games first.
 */
export interface GameSet {
  name: string
  score: string
  winner: string | null
}
