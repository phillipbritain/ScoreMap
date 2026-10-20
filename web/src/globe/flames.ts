import type { ExpressionSpecification, Map as MapLibreMap } from 'maplibre-gl'

/**
 * Whether a game shows flames: a hot game (see GLOSSARY.md), while the viewer has them on ("Flames on
 * hot games" in Colours). Its score card, small pin, and any pin cluster or card cluster it's in, show them.
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
 * A flame `size` pixels tall, in `colour`, with a paler core so it reads as burning, its tip leaning a
 * little: drawn at the screen's pixel ratio, so it's sharp. Null if the browser can't draw it.
 */
function drawFlame(size: number, colour: string, pixelRatio: number): ImageData | null {
  const height = Math.max(1, Math.round(size * pixelRatio))
  const width = Math.max(1, Math.round(height * flameWidth))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) return null
  // A tongue in a box 1 across and 1 down: its tip at the top, its base round at the bottom.
  const tongue = new Path2D()
  tongue.moveTo(0.55, 0)
  tongue.bezierCurveTo(0.62, 0.22, 1, 0.38, 0.96, 0.68)
  tongue.bezierCurveTo(0.93, 0.9, 0.73, 1, 0.5, 1)
  tongue.bezierCurveTo(0.27, 1, 0.07, 0.9, 0.04, 0.68)
  tongue.bezierCurveTo(0.01, 0.46, 0.32, 0.36, 0.55, 0)
  context.scale(width, height)
  context.fillStyle = colour
  context.fill(tongue)
  // The core: a smaller tongue at the base, paler.
  context.translate(0.24, 0.4)
  context.scale(0.52, 0.6)
  context.fillStyle = 'rgba(255, 255, 255, 0.55)'
  context.fill(tongue)
  return context.getImageData(0, 0, width, height)
}
