import type { ExpressionSpecification } from 'maplibre-gl'
import { accentColour } from '../settings/gameColour'
import type { Theme } from '../theme/theme'

/**
 * The colour a cluster's games share (pin clusters, card clusters and venue clusters alike), kept on
 * the cluster's feature as a key (see sharedColourKey) that clusterColour turns into a colour by the
 * theme: the shared game colour, or `mixed` when its games' colours differ. The key doesn't depend on
 * the theme, so the pin source needn't change when the theme does.
 */
export const sharedColorProperty = 'sharedColor'
const mixed = 'mixed'

/** The shared colour key of a group of games, each with its game colour (see gameColour). */
export function sharedColourKey(games: readonly { color: string }[]): string {
  const colours = new Set(games.map((game) => game.color))
  return colours.size === 1 ? [...colours][0] : mixed
}

/**
 * sharedColourKey gathered by the pin source over a pin cluster's pins, as a MapLibre cluster property:
 * each pin's game colour, and two gathered keys merged into one.
 */
export const pinClusterSharedColour: Record<string, [ExpressionSpecification, ExpressionSpecification]> = {
  [sharedColorProperty]: [
    ['case', ['==', ['accumulated'], ['get', sharedColorProperty]], ['accumulated'], mixed],
    ['get', 'color'],
  ],
}

/**
 * A cluster's colour, from its shared colour key: the colour its games share, or the theme's accent
 * when they're of different colours, so a cluster's colour never misleads.
 */
export function clusterColour(theme: Theme): ExpressionSpecification {
  return ['match', ['get', sharedColorProperty], mixed, accentColour(theme), ['to-string', ['get', sharedColorProperty]]]
}
