import type { ExpressionSpecification, Map as MapLibreMap } from 'maplibre-gl'

/**
 * Whether a game shows flames: a hot game (see GLOSSARY.md), while the viewer has them on ("Flames on
 * hot games" in Display Settings). Its score card, small pin, and any pin cluster or card cluster it's in, show them.
 */
export function showsFlames(on: boolean, game: { hot: boolean }): boolean {
  return on && game.hot
}

/** How wide a flame is, as a share of how tall. */
const flameWidth = 0.7

/**
 * The map's image of a flame `size` pixels tall in a colour (a game's, or a cluster's expression, see
 * clusterColour): its id, which the map draws the first time a layer asks for it (see drawFlamesOnDemand).
 * There are as many as there are game colours and flame sizes, so they're drawn as they're wanted.
 */
export function flameImage(size: number, colour: ExpressionSpecification | string): ExpressionSpecification {
  return ['concat', `flame:${size}:`, colour]
}

/**
 * Draws each flame image a layer asks for (see flameImage) that the map hasn't got yet, as the map's
 * resolver of missing images: the only images the globe draws as they're wanted.
 */
export function drawFlamesOnDemand(map: MapLibreMap): void {
  map.setMissingStyleImageResolver((id) => {
    const flame = /^flame:([\d.]+):(.+)$/.exec(id)
    if (!flame || map.hasImage(id)) return
    const pixelRatio = window.devicePixelRatio || 1
    const image = drawFlame(Number(flame[1]), flame[2], pixelRatio)
    if (image) map.addImage(id, image, { pixelRatio })
  })
}

/**
 * A flame `size` pixels tall, in `colour`, with a paler core so it reads as burning: drawn at the
 * screen's pixel ratio, so it's sharp. Null if the browser can't draw it.
 */
function drawFlame(size: number, colour: string, pixelRatio: number): ImageData | null {
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
  context.fillStyle = colour
  context.fill(tongue)
  // The core: a smaller flame at the base, paler.
  context.translate(24, 40)
  context.scale(0.52, 0.6)
  context.fillStyle = 'rgba(255, 255, 255, 0.55)'
  context.fill(tongue)
  return context.getImageData(0, 0, width, height)
}
