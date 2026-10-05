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
}

export interface Game {
  id: string
  league: string
  sport: string
  /** ISO 8601 instant. */
  startTime: string
  home: GameTeam
  away: GameTeam
  clock: string | null
  period: number | null
  venue: GameVenue
}
