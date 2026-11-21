import type { ExpressionSpecification } from 'maplibre-gl'
import { accentColor } from '../settings/gameColor'
import type { Theme } from '../theme/theme'

/**
 * The color a cluster's games share (card clusters and venue clusters alike), kept on
 * the cluster's feature as a key (see sharedColorKey) that clusterColor turns into a color by the
 * theme: the shared game color, or `mixed` when its games' colors differ. The key doesn't depend on
 * the theme, so the pin source needn't change when the theme does.
 */
export const sharedColorProperty = 'sharedColor'
/** The shared color key of games whose colors differ. */
export const mixedColors = 'mixed'

/** The shared color key of a group of games, each with its game color (see gameColor). */
export function sharedColorKey(games: readonly { color: string }[]): string {
  const colors = new Set(games.map((game) => game.color))
  return colors.size === 1 ? [...colors][0] : mixedColors
}

/**
 * A cluster's color, from its shared color key: the color its games share, or the theme's accent
 * when they're of different colors, so a cluster's color never misleads.
 */
export function clusterColor(theme: Theme): ExpressionSpecification {
  return ['match', ['get', sharedColorProperty], mixedColors, accentColor(theme), ['to-string', ['get', sharedColorProperty]]]
}
