// PROTOTYPE (throwaway): game panel layout variants, see ./README.md. Not production code: no tests, no polish.
// Data shaping shared by the variants, so each variant only differs in layout. Kept out of main.
import type { CSSProperties, KeyboardEvent, Ref } from 'react'
import { boutLine, shownBout } from '../../games/bouts'
import { positionText, type Game, type GameBout, type GameEntrant, type GameField } from '../../games/game'
import { progressLine } from '../../games/progressLine'
import { sidesTopFirst } from '../../games/sides'
import type { Scorer } from '../../games/scorers'
import { streamLinks } from '../streamLinks'
import { mapsSearchUrl, venuePlace } from '../venuePlace'
import { viewerCountry, watchLinks } from '../watchLinks'

export interface VariantProps {
  game: Game
  scorer?: Scorer
  color: string
  textOnColor: string
  onClose: () => void
  /** Attach where the globe should keep the selected pin clear of; see panelClearance.ts. */
  panelRef: Ref<HTMLElement>
}

/** One row of the score: a team, a field's entrant, or a bout's side. */
export interface ScoreRow {
  key: string
  mark: string | null
  name: string
  short: string
  /** Rank or position, before the name. */
  before: string | null
  /** Record, after the name. */
  after: string | null
  value: string
  scoredAt: number | null
}

export interface PanelLink {
  name: string
  url: string | null
  unofficial: boolean
}

export interface PanelFacts {
  rows: ScoreRow[]
  progress: string | null
  venueName: string
  place: string
  mapsUrl: string | null
  placeUrl: string | null
  links: PanelLink[]
  photo: { url: string; credit: string | null } | null
  field: GameField | null
  bouts: GameBout[]
  boutsShown: GameBout | null
}

export function panelFacts(game: Game, scorer: Scorer | undefined): PanelFacts {
  const { venue, contest } = game
  const place = venuePlace(venue)
  const tennis = game.sport === 'Tennis'
  const venueName = (tennis ? [venue.court, place].filter(Boolean).join(' · ') : venue.name) || 'Unknown venue'
  let rows: ScoreRow[] = []
  if (contest.kind === 'sides') {
    rows = sidesTopFirst(game.sport, contest).map((team, i) => ({
      key: `${i}`,
      mark: team.logoUrl,
      name: team.fullName,
      short: team.abbreviation,
      before: team.rank !== null ? `#${team.rank}` : null,
      after: team.record,
      value: team.score ?? '–',
      scoredAt: scorer && contest[scorer.side] === team ? scorer.at : null,
    }))
  } else if (contest.kind === 'field') {
    rows =
      contest.entries.length === 0
        ? [{ key: 'name', mark: null, name: game.note ?? game.league, short: game.note ?? game.league, before: null, after: null, value: '', scoredAt: null }]
        : contest.entries.slice(0, 2).map((entrant) => ({
            key: entrant.name,
            mark: entrant.flagUrl,
            name: entrant.name,
            short: entrant.shortName,
            before: positionText(entrant, contest),
            after: null,
            value: entrant.score ?? '',
            scoredAt: null,
          }))
  } else {
    const bout = shownBout(contest)
    rows = [bout.first, bout.second].map((side) => ({
      key: side.name,
      mark: side.flagUrl,
      name: side.name,
      short: side.shortName,
      before: null,
      after: side.record,
      value: side.winner ? 'W' : '',
      scoredAt: null,
    }))
  }
  const links: PanelLink[] = [
    ...watchLinks(game.broadcasters, viewerCountry(navigator.languages)).map((link) => ({ ...link, unofficial: false })),
    ...streamLinks(game.streamLinks).map((link) => ({ name: link.site, url: link.url, unofficial: true })),
  ]
  return {
    rows,
    progress: progressLine(game, 'full'),
    venueName,
    place: tennis ? '' : place,
    mapsUrl: venue.name ? mapsSearchUrl([venue.name, place].filter(Boolean).join(', ')) : null,
    placeUrl: place ? mapsSearchUrl(place) : null,
    links,
    photo: venue.photo ? { url: venue.photo.url, credit: venue.photo.credit ? `${venue.photo.credit.author}, ${venue.photo.credit.license}` : null } : null,
    field: contest.kind === 'field' && contest.entries.length > 0 ? contest : null,
    bouts: contest.kind === 'bouts' ? contest.bouts : [],
    boutsShown: contest.kind === 'bouts' ? shownBout(contest) : null,
  }
}

export const entrantPosition = (entrant: GameEntrant, field: GameField) => positionText(entrant, field)

export { boutLine }

export const closeOnEscape = (onClose: () => void) => (event: KeyboardEvent) => {
  if (event.key === 'Escape') {
    event.stopPropagation()
    onClose()
  }
}

/** The game's color on the panel, as the real panel sets it. */
export const colorStyle = (color: string, textOnColor: string) =>
  ({ '--game-color': color, '--text-on-game-color': textOnColor }) as CSSProperties

/** What the contest's detail section is called, or null when there's nothing to show. */
export function boardLabel(game: Game, facts: PanelFacts): string | null {
  if (facts.field) return 'Leaderboard'
  if (facts.bouts.length > 0) return 'Fight card'
  if (game.scoreline) return 'Sets'
  if (game.lastScore) return 'Last score'
  return null
}
