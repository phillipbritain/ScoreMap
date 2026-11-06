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

/**
 * A game as the Games list shows it: just who's playing, two sides top first, or the event's name (a fight
 * card's, a field's), with no score or clock.
 */
export function gameMatchup(game: Game): string {
  const { contest } = game
  switch (contest.kind) {
    case 'sides': {
      const [top, bottom] = sidesTopFirst(game.sport, contest)
      return `${top.fullName} vs ${bottom.fullName}`
    }
    case 'bouts': {
      const bout = shownBout(contest)
      return game.note ?? (bout ? `${bout.first.name} vs ${bout.second.name}` : game.league)
    }
    case 'field':
      return game.note ?? game.venue.name ?? game.league
  }
}

/**
 * Whether a game answers a search of the Games list: every word of it found, in any order, in the game's
 * name, league, venue or place, or the name of anyone in it, ignoring case and accents. An empty search
 * matches every game.
 */
export function matchesSearch(game: Game, query: string): boolean {
  const words = fold(query).split(/\s+/).filter(Boolean)
  if (words.length === 0) return true
  const text = fold(searchText(game))
  return words.every((word) => text.includes(word))
}

function searchText(game: Game): string {
  const { contest, venue } = game
  const people = contest.kind === 'sides'
    ? [contest.home.abbreviation, contest.away.abbreviation]
    : contest.kind === 'field'
      ? contest.entries.map((entry) => entry.name)
      : contest.bouts.flatMap((bout) => [bout.first.name, bout.second.name])
  return [gameLabel(game), game.sport, venue.name, venue.city, venue.region, venue.country, venue.court, ...people]
    .filter(Boolean)
    .join(' ')
}

function fold(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase()
}
