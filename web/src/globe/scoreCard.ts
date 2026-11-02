import { shownBout } from '../games/bouts'
import { positionText, type Game, type GameBoutSide, type GameEntrant, type GameField, type GameStatus, type GameTeam } from '../games/game'
import { progressLine } from '../games/progressLine'
import { sidesTopFirst } from '../games/sides'
import { isHexColor, mixColours, textOn } from '../theme/palette'
import type { Theme } from '../theme/theme'

export interface ScoreCardRow {
  /**
   * A side's abbreviation, an entrant's position and short name ("1 K. Larson"), a bout's side's short name
   * ("J. Jones"), or a game's name before its field is listed.
   */
  label: string
  logoUrl: string | null
  /** Blank until the game has a score; for a bout's side, "W" once they've won it. */
  score: string
}

/**
 * What a zoomed-in pin shows: both sides' logos, abbreviations and scores, top first (see sidesTopFirst),
 * and a short clock line. A field shows its top two entrants by position ("1 K. Larson") with their flags
 * and in golf their scores to par, or before its field is listed, the game's name (its note) on top. A fight card shows the
 * bout on now, else its main event (see shownBout), as two sides with their flags, the winner marked "W".
 */
export interface ScoreCard {
  gameId: string
  /** Drives the card's style, matching the small pin's status style. */
  status: GameStatus
  top: ScoreCardRow
  bottom: ScoreCardRow
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
    clockLine: game.contest.kind === 'bouts' && game.status === 'Upcoming'
      ? new Date(game.startTime).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
      : progressLine(game, 'short') ?? '',
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

function cardRows({ sport, contest, note }: Game): [ScoreCardRow, ScoreCardRow] {
  if (contest.kind === 'sides') {
    const [top, bottom] = sidesTopFirst(sport, contest)
    return [cardTeam(top), cardTeam(bottom)]
  }
  if (contest.kind === 'bouts') {
    const { first, second } = shownBout(contest)
    return [cardBoutSide(first), cardBoutSide(second)]
  }
  const blank: ScoreCardRow = { label: '', logoUrl: null, score: '' }
  if (contest.entries.length === 0) return [{ ...blank, label: note ?? '' }, blank]
  const [first, second] = contest.entries.map((entrant) => cardEntrant(entrant, contest))
  return [first, second ?? blank]
}

function cardTeam({ abbreviation, logoUrl, score }: GameTeam): ScoreCardRow {
  return { label: abbreviation, logoUrl, score: score ?? '' }
}

function cardBoutSide({ shortName, flagUrl, winner }: GameBoutSide): ScoreCardRow {
  return { label: shortName, logoUrl: flagUrl, score: winner ? 'W' : '' }
}

function cardEntrant(entrant: GameEntrant, field: GameField): ScoreCardRow {
  return { label: `${positionText(entrant, field)} ${entrant.shortName}`, logoUrl: entrant.flagUrl, score: entrant.score ?? '' }
}
