// A game as the server sends it over SignalR.
// Mirrors server/src/ScoreMap.Server/Games/Game.cs (ADR-0003: shapes are defined on both sides).

export interface GameTeam {
  abbreviation: string
  fullName: string
  logoUrl: string | null
  score: number | null
}

export interface GameVenue {
  name: string | null
  city: string | null
  country: string | null
  latitude: number
  longitude: number
  /** The venue's IANA time zone, e.g. "America/Chicago"; null when the venue could not be placed. */
  timeZone: string | null
}

/** A channel or streaming service showing a game. */
export interface GameBroadcaster {
  name: string
  /** The country it broadcasts to (ISO 3166 alpha-2, e.g. "US"), when known. */
  country: string | null
  /** The service's official watch page, when the server's watch links file lists it. */
  watchUrl: string | null
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
  home: GameTeam
  away: GameTeam
  clock: string | null
  period: number | null
  venue: GameVenue
  broadcasters: GameBroadcaster[]
}
