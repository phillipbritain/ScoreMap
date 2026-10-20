import type { Map as MapLibreMap } from 'maplibre-gl'
import type { Theme } from '../theme/theme'

/**
 * Whether a game shows flames: a hot game (see GLOSSARY.md), while the viewer has them on ("Flames on
 * hot games" in Display Settings). Its score card, small pin, and any pin cluster or card cluster it's in, show them.
 */
export function showsFlames(on: boolean, game: { hot: boolean }): boolean {
  return on && game.hot
}

/** How wide a flame is, as a share of how tall. */
const flameWidth = 0.7

/** A flame's colours: its tips, its middle and its white-hot core (the theme's score card fire's). */
interface FireColours {
  tips: string
  middle: string
  core: string
}

/**
 * The map's image of a flame `size` pixels tall in the theme's fire colours, as a score card's fire is:
 * its id, which the map draws the first time a layer asks for it (see drawFlamesOnDemand). The id
 * carries the colours, so a change of theme asks for a new image.
 */
export function flameImage(theme: Theme, size: number): string {
  const { tips, middle, core } = theme.components.ScoreCard.flames
  return ['flame', size, tips, middle, core].join('|')
}

/**
 * Draws each flame image a layer asks for (see flameImage) that the map hasn't got yet, as the map's
 * resolver of missing images: the only images the globe draws as they're wanted.
 */
export function drawFlamesOnDemand(map: MapLibreMap): void {
  map.setMissingStyleImageResolver((id) => {
    const [kind, size, tips, middle, core] = id.split('|')
    if (kind !== 'flame' || map.hasImage(id)) return
    const pixelRatio = window.devicePixelRatio || 1
    const image = drawFlame(Number(size), { tips, middle, core }, pixelRatio)
    if (image) map.addImage(id, image, { pixelRatio })
  })
}

/**
 * A flame `size` pixels tall, in three bands as a score card's tongue of fire is (its tips, middle and
 * core, one inside another; see index.css): drawn at the screen's pixel ratio, so it's sharp. Null if
 * the browser can't draw it.
 */
function drawFlame(size: number, { tips, middle, core }: FireColours, pixelRatio: number): ImageData | null {
  const height = Math.max(1, Math.round(size * pixelRatio))
  const width = Math.max(1, Math.round(height * flameWidth))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) return null
  // A flame in a box 100 across and 100 down: a main tip, a smaller lick to its left, a round base. The
  // score cards' tongues are the same shape (see index.css).
  const tongue = new Path2D('M54 0C60 22 80 30 87 50C95 72 84 93 62 99C56 100 44 100 38 99C16 93 6 73 13 53C17 43 25 37 29 25C34 37 32 47 38 53C39 33 47 17 54 0Z')
  context.scale(width / 100, height / 100)
  // Each band a smaller flame at the base of the one before, filled bottom to top.
  const band = (left: number, top: number, scaleX: number, scaleY: number, stops: [number, string][]) => {
    context.save()
    context.translate(left, top)
    context.scale(scaleX, scaleY)
    const fill = context.createLinearGradient(0, 100, 0, 0)
    for (const [at, colour] of stops) fill.addColorStop(at, colour)
    context.fillStyle = fill
    context.fill(tongue)
    context.restore()
  }
  band(0, 0, 1, 1, [
    [0.3, middle],
    [0.75, tips],
  ])
  band(14, 25, 0.72, 0.75, [
    [0.15, core],
    [0.7, middle],
  ])
  band(30, 58, 0.4, 0.42, [[0, core]])
  return context.getImageData(0, 0, width, height)
}
