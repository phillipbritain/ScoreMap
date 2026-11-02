import type { Game, GameEntrant, GameStatus, GameTeam } from '../games/game'
import { progressLine } from '../games/progressLine'
import { sidesTopFirst } from '../games/sides'
import { isHexColor, mixColours, textOn } from '../theme/palette'
import type { Theme } from '../theme/theme'

export interface ScoreCardTeam {
  abbreviation: string
  logoUrl: string | null
  /** Blank until the game has a score. */
  score: string
}

/**
 * What a zoomed-in pin shows: both sides' logos, abbreviations and scores, top first (see sidesTopFirst),
 * and a short clock line. A field shows its top two entrants by position ("1 K. Larson") with their flags
 * and no score, or before its field is listed, the game's name (its note) on top.
 */
export interface ScoreCard {
  gameId: string
  /** Drives the card's style, matching the small pin's status style. */
  status: GameStatus
  top: ScoreCardTeam
  bottom: ScoreCardTeam
  /** Blank when there is nothing to show, such as before an Upcoming game starts. */
  clockLine: string
  /** Flames rising from its top edge, when its game shows them (see showsFlames). */
  flames: boolean
}

export function scoreCard(game: Game, flames: boolean): ScoreCard {
  const [top, bottom] = cardRows(game)
  return {
    gameId: game.id,
    status: game.status,
    top,
    bottom,
    clockLine: progressLine(game, 'short') ?? '',
    flames,
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

function cardRows({ sport, contest, note }: Game): [ScoreCardTeam, ScoreCardTeam] {
  if (contest.kind === 'sides') {
    const [top, bottom] = sidesTopFirst(sport, contest)
    return [cardTeam(top), cardTeam(bottom)]
  }
  const blank: ScoreCardTeam = { abbreviation: '', logoUrl: null, score: '' }
  if (contest.entries.length === 0) return [{ ...blank, abbreviation: note ?? '' }, blank]
  const [first, second] = contest.entries.map(cardEntrant)
  return [first, second ?? blank]
}

function cardTeam({ abbreviation, logoUrl, score }: GameTeam): ScoreCardTeam {
  return { abbreviation, logoUrl, score: score ?? '' }
}

function cardEntrant({ position, shortName, flagUrl }: GameEntrant): ScoreCardTeam {
  return { abbreviation: `${position} ${shortName}`, logoUrl: flagUrl, score: '' }
}
