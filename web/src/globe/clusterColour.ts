import type { ExpressionSpecification } from 'maplibre-gl'
import type { GameStatus } from '../games/game'
import { accentColour } from '../settings/gameColour'
import type { Theme } from '../theme/theme'

/**
 * The colour a cluster's games share (pin clusters, card clusters and venue clusters alike), kept on
 * the cluster's feature as a key (see sharedColourKey) that clusterColour turns into a colour by the
 * theme: the shared game colour, `mixed` when its games' colours differ, or `none` when all its games
 * are Disrupted. Disrupted games are left out, as they're greyed out whatever their colour. The key
 * doesn't depend on the theme, so the pin source needn't change when the theme does.
 */
export const sharedColorProperty = 'sharedColor'
const mixed = 'mixed'
const none = 'none'

/** The shared colour key of a group of games, each with its game colour (see gameColour). */
export function sharedColourKey(games: readonly { status: GameStatus; color: string }[]): string {
  const colours = new Set(games.filter((game) => game.status !== 'Disrupted').map((game) => game.color))
  return colours.size === 0 ? none : colours.size === 1 ? [...colours][0] : mixed
}

/**
 * sharedColourKey gathered by the pin source over a pin cluster's pins, as a MapLibre cluster property:
 * each pin's game colour (none if Disrupted), and two gathered keys merged into one.
 */
export const pinClusterSharedColour: Record<string, [ExpressionSpecification, ExpressionSpecification]> = {
  [sharedColorProperty]: [
    [
      'case',
      ['==', ['accumulated'], none],
      ['get', sharedColorProperty],
      ['any', ['==', ['get', sharedColorProperty], none], ['==', ['accumulated'], ['get', sharedColorProperty]]],
      ['accumulated'],
      mixed,
    ],
    ['case', ['==', ['get', 'status'], 'Disrupted'], none, ['get', 'color']],
  ],
}

/**
 * A cluster's colour, from its shared colour key: the colour its games share, the theme's accent when
 * they're of different colours, so a cluster's colour never misleads, or Disrupted's when all are.
 */
export function clusterColour(theme: Theme): ExpressionSpecification {
  return [
    'match',
    ['get', sharedColorProperty],
    mixed,
    accentColour(theme),
    none,
    theme.palette.disrupted.main,
    ['to-string', ['get', sharedColorProperty]],
  ]
}
