import type { Game, GameStatus, GameTeam } from '../games/game'
import { progressLine } from '../games/progressLine'
import { isHexColor, mixColours, textOn } from '../theme/palette'
import type { Theme } from '../theme/theme'

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
    clockLine: progressLine(game, 'short') ?? '',
  }
}

/**
 * The colour of the text on a score card's header, which is tinted with its game's colour (see
 * gameColour) over the card's fill: whichever of the card's text and its fill stands out from the
 * tint more (see textOn), so the clock line stays readable whatever colour the viewer picks. A
 * Disrupted card's own text and fill. The card's text where the theme gives its colours other than
 * as #rrggbb, as the tint can't then be worked out.
 */
export function headerText(colour: string, status: GameStatus, theme: Theme): string {
  const card = theme.components.ScoreCard
  const { fill, text } = status === 'Disrupted' ? card.disrupted : card
  if (![colour, fill].every(isHexColor)) return text
  return textOn(mixColours(fill, colour, card.header.tint), text, fill)
}

function cardTeam({ abbreviation, logoUrl, score }: GameTeam): ScoreCardTeam {
  return { abbreviation, logoUrl, score: score ?? '' }
}
