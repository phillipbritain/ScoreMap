import { shownBout } from './bouts'
import type { Game } from './game'
import { progressLine } from './progressLine'

/** A game's full name and current progress, shared by its keyboard selection controls. */
export function gameLabel(game: Game): string {
  const { contest } = game
  let name: string
  switch (contest.kind) {
    case 'sides':
      name = `${contest.away.fullName} ${contest.away.score ?? ''} vs ${contest.home.fullName} ${contest.home.score ?? ''}`
      break
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
