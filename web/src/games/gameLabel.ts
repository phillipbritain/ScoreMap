import { shownBout } from './bouts'
import type { Game } from './game'
import { progressLine } from './progressLine'
import { sidesTopFirst } from './sides'

/**
 * A game's full name and current progress, shared by its keyboard selection controls: two sides top first,
 * as its card shows them (see sidesTopFirst).
 */
export function gameLabel(game: Game): string {
  const { contest } = game
  let name: string
  switch (contest.kind) {
    case 'sides': {
      const [top, bottom] = sidesTopFirst(game.sport, contest)
      name = `${top.fullName} ${top.score ?? ''} vs ${bottom.fullName} ${bottom.score ?? ''}`
      break
    }
    case 'bouts': {
      const bout = shownBout(contest)
      name = [game.note, bout && `${bout.first.name} vs ${bout.second.name}`].filter(Boolean).join(' · ')
      break
    }
    case 'field':
      name = game.note ?? game.venue.name ?? game.league
      break
  }
  const progress = progressLine(game, 'full')
  return [game.league, name.trim(), game.status, progress === game.status ? null : progress].filter(Boolean).join(' · ')
}
