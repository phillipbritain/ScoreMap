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
  /** A photo of the venue (from outside or of the playing area); null until the server finds one, and for venues with none. */
  photo: VenuePhoto | null
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
  /** Unofficial stream links; empty when the stream finder found none or is switched off. */
  streamLinks: StreamLink[]
}
