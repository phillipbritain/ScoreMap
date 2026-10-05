import type { Game, GameStatus, GameTeam } from '../games/game'
import { clockLine } from './pinFeatures'

export interface ScoreCardTeam {
  abbreviation: string
  logoUrl: string | null
  /** Blank until the game has a score. */
  score: string
}

/** What a zoomed-in pin shows: both teams' logos, abbreviations and scores, and a short clock line. */
export interface ScoreCard {
  gameId: string
  /** Drives the card's style, matching the small pin's status style. */
  status: GameStatus
  away: ScoreCardTeam
  home: ScoreCardTeam
  /** Blank when there is nothing to show, such as before an Upcoming game starts. */
  clockLine: string
}

export function scoreCard(game: Game): ScoreCard {
  return {
    gameId: game.id,
    status: game.status,
    away: cardTeam(game.away),
    home: cardTeam(game.home),
    clockLine: clockLine(game) ?? '',
  }
}

function cardTeam({ abbreviation, logoUrl, score }: GameTeam): ScoreCardTeam {
  return { abbreviation, logoUrl, score: score === null ? '' : String(score) }
}
