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
  /** Its conference ("SEC") among its league's (see League); null in a league without them, or for a team in none of them. */
  conference: string | null
}

export interface GameVenue {
  /** In tennis, the tournament ("Rolex Shanghai Masters"). */
  name: string | null
  city: string | null
  /** Its state, province or the like: in full for a US state or Canadian province ("Arizona"), as the feed gives it otherwise; null when there's none. */
  region: string | null
  country: string | null
  /** Its position once placed (looked up, given with the venue or corrected); both null while unplaced: its lookup still pending, or finished without finding it. */
  latitude: number | null
  longitude: number | null
  /** The venue's IANA time zone, e.g. "America/Chicago"; null while the venue is unplaced. */
  timeZone: string | null
  /** A photo of the venue (from outside or of the playing area); null until the server finds one, and for venues with none. */
  photo: VenuePhoto | null
  /** Tennis: the court the match is on ("Stadium Court"); null in other sports, or until the feed names it. */
  court: string | null
}

/** A photo of a venue, for the top of the game panel. */
export interface VenuePhoto {
  url: string
  /** Set when the photo's license asks for attribution (Wikimedia Commons photos). */
  credit: PhotoCredit | null
}

/** Who took a photo and under what license. */
export interface PhotoCredit {
  author: string
  license: string
  licenseUrl: string | null
  /** The photo's own page, with its full license terms. */
  sourceUrl: string
}

/** An unofficial stream for a game, found by the server's stream finder (ADR-0002: hobby v1 only). */
export interface StreamLink {
  /** The owner's name for the site the link was found on. */
  site: string
  url: string
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

/** What a soccer or rugby key event was; a rugby penalty goal is a PenaltyGoal. */
export type KeyEventKind = 'Goal' | 'PenaltyGoal' | 'OwnGoal' | 'YellowCard' | 'RedCard' | 'Try' | 'Conversion' | 'DropGoal'

/** A goal or card in soccer, or a score or card in rugby: the team (its abbreviation), the player and the minute ("23'"). */
export interface KeyEvent {
  kind: KeyEventKind
  team: string
  player: string | null
  clock: string | null
}

/**
 * Who competes in a game, and their scores, in one of the shapes a game's score takes (ADR-0020), told
 * apart by its kind: two sides, a field, or a fight card's bouts.
 */
export type GameContest = GameSides | GameField | GameBouts

/** A game between two sides: the home side and the away side. */
export interface GameSides {
  kind: 'sides'
  home: GameTeam
  away: GameTeam
}

/**
 * A game among a field, such as a race or a golf tournament: its entrants ordered by position, the leader
 * first; none before the feed lists them.
 */
export interface GameField {
  kind: 'field'
  entries: GameEntrant[]
}

/**
 * One of a field: their position (1 for the leader, shared by those tied on score), name, short name
 * ("K. Larson") and their country's flag. In golf, their score to par ("-12", "E", "+3"); null in racing.
 */
export interface GameEntrant {
  position: number
  name: string
  shortName: string
  flagUrl: string | null
  score: string | null
}

/** An entrant's position as a leaderboard writes it: "2", or "T2" when they share it with another. */
export function positionText({ position }: GameEntrant, { entries }: GameField): string {
  return entries.filter((other) => other.position === position).length > 1 ? `T${position}` : `${position}`
}

/** A fight card: its bouts, the main event first (the reverse of the order they're fought in). */
export interface GameBouts {
  kind: 'bouts'
  bouts: GameBout[]
}

/**
 * One bout on a fight card: its two sides, its weight class ("Lightweight"), how many rounds it's scheduled
 * for, its status, the round it's in or ended in and the time into that round ("1:28"; each null before it
 * starts), and once it's over how it was won ("KO/TKO", "Submission" or "Decision"; null for a draw or no
 * contest, or when the feed doesn't say).
 */
export interface GameBout {
  id: string
  first: GameBoutSide
  second: GameBoutSide
  weightClass: string | null
  scheduledRounds: number
  status: BoutStatus
  round: number | null
  clock: string | null
  method: string | null
}

/** One of a bout's two sides: their name, short name ("R. Moicano"), country's flag, record ("21-7-1") and whether they won it. */
export interface GameBoutSide {
  name: string
  shortName: string
  flagUrl: string | null
  record: string | null
  winner: boolean
}

/**
 * A game's status in ScoreMap's terms (see GLOSSARY.md). A game postponed, suspended or canceled
 * isn't shown at all (ADR-0021), so the server never sends one Disrupted.
 */
export type GameStatus = 'Upcoming' | 'Live' | 'Final'

/** A fight card's bout's status: a game's, or Disrupted when the bout is called off. */
export type BoutStatus = GameStatus | 'Disrupted'

export interface Game {
  id: string
  league: string
  sport: string
  /** ISO 8601 instant. */
  startTime: string
  status: GameStatus
  /** A Live game paused by a delay, such as a rain delay. */
  delayed: boolean
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
   * the lead, with little left to play, by its sport's rule (the server's HotGame). It shows flames.
   */
  hot: boolean
  venue: GameVenue
  /** Unofficial stream links; empty when the stream finder found none or is switched off. */
  streamLinks: StreamLink[]
  /** What's special about the game, as the feed puts it: a playoff round ("NLDS - Game 2"), a game abroad ("NFL London Games"). */
  note: string | null
  /** Where play stands right now; only while the game is Live. */
  situation: GameSituation | null
  /** The last score; null before anyone scores, and in cricket. */
  lastScore: ScoringPlay | null
  /** Soccer and rugby: the scores and cards so far, in the order they happened; empty in other sports. */
  keyEvents: KeyEvent[]
  /** Whether ESPN lists the game in its Top Events: the games it picks as the most important right now. */
  topEvent: boolean
  /** Tennis: the score set by set; null in other sports and before play. */
  scoreline: GameScoreline | null
  /** The game's page on ESPN's website, linked from the game panel; null when ESPN lists none. */
  espnUrl: string | null
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
