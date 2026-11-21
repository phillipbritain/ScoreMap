import { shownBout } from '../games/bouts'
import { entrantImage, type Game, type GameBoutSide, type GameEntrant, type GameStatus, type GameTeam } from '../games/game'
import { progressLine, type Viewer } from '../games/progressLine'
import { sidesTopFirst } from '../games/sides'
import { logoMark } from '../games/teamLogo'
import { isHexColor, mixColors, textOn } from '../theme/palette'
import type { Theme } from '../theme/theme'

export interface ScoreCardRow {
  /**
   * A side's abbreviation, an entrant's short name ("K. Larson"), a bout's side's short name
   * ("J. Jones"), or a game's name before its field is listed.
   */
  label: string
  /** A college team's place in its poll ("5"), shown before its abbreviation; absent when unranked. */
  rank?: string
  logoUrl: string | null
  /** A team's mark (see logoMark), shown on the logo's plate when it has no logo or its logo won't load; absent for an entrant or a bout's side, whose missing flag leaves its space empty. */
  mark?: string
  /** Blank until the game has a score; for a bout's side, "W" once they've won it. */
  score: string
}

/**
 * What a zoomed-in pin shows: both sides' logos, abbreviations and scores, top first (see sidesTopFirst),
 * and a short clock line. A field shows its top three entrants (fewer when it has fewer, but always two
 * rows) by name with their flags, in order, so their places go unsaid; in golf with their scores to par.
 * Before its field is listed, the game's name (its note) on top. A fight card shows the bout on now, else
 * its main event (see shownBout), as two sides with their flags, the winner marked "W".
 */
export interface ScoreCard {
  gameId: string
  /** Drives the card's style, matching the small pin's status style. */
  status: GameStatus
  /** Its rows, top first: two sides, or a field's top three. */
  rows: ScoreCardRow[]
  /** Its start time before an Upcoming game starts; blank when there is nothing to show. */
  clockLine: string
  /** The hot indicator, a glowing outline around its edge, when its game is hot. */
  hotIndicator: boolean
}

/**
 * A game's score card. Before an Upcoming game starts, its clock line is its start time in the viewer's
 * time ("1:00 PM"; ADR-0029): `viewer` gives the time zone and locale, the browser's unless given.
 */
export function scoreCard(game: Game, viewer: Viewer = {}): ScoreCard {
  return {
    gameId: game.id,
    status: game.status,
    rows: cardRows(game),
    clockLine: progressLine(game, 'short', viewer) ?? '',
    hotIndicator: game.hot,
  }
}

/**
 * The color of the text on a score card's header, which is tinted with its game's color (see
 * gameColor) over the card's fill: whichever of the card's text and its fill stands out from the
 * tint more (see textOn), so the clock line stays readable whatever color the viewer picks. The
 * card's text where the theme gives its colors other than as #rrggbb, as the tint can't then be
 * worked out.
 */
export function headerText(color: string, theme: Theme): string {
  const card = theme.components.ScoreCard
  const { fill, text } = card
  if (![color, fill].every(isHexColor)) return text
  return textOn(mixColors(fill, color, card.header.tint), text, fill)
}

/** How many of a field its score card shows, top first. */
const fieldRows = 3

function cardRows({ sport, contest, note }: Game): ScoreCardRow[] {
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
  const rows = contest.entries.slice(0, fieldRows).map(cardEntrant)
  return rows.length === 1 ? [...rows, blank] : rows
}

function cardTeam({ abbreviation, logoUrl, score, rank }: GameTeam): ScoreCardRow {
  const row = { label: abbreviation, logoUrl, mark: logoMark(abbreviation), score: score ?? '' }
  return rank === null ? row : { ...row, rank: String(rank) }
}

function cardBoutSide({ shortName, flagUrl, winner }: GameBoutSide): ScoreCardRow {
  return { label: shortName, logoUrl: flagUrl, score: winner ? 'W' : '' }
}

/** An entrant on a score card: their short name, and in golf their score to par; their place is their row's. */
function cardEntrant(entrant: GameEntrant): ScoreCardRow {
  return { label: entrant.shortName, logoUrl: entrantImage(entrant), score: entrant.score ?? '' }
}
