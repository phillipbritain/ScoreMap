import type { Map as MapLibreMap, StyleImageInterface } from 'maplibre-gl'
import type { Theme } from '../theme/theme'

/**
 * Whether a game shows flames: a hot game (see GLOSSARY.md), while the viewer has them on ("Flames on
 * hot games" in Display Settings). Its score card, small pin, and any pin cluster or card cluster it's in, show them.
 */
export function showsFlames(on: boolean, game: { hot: boolean }): boolean {
  return on && game.hot
}

type FireOutline = Theme['components']['Pin']['flame']
type FireColors = Pick<Theme['components']['ScoreCard']['flames'], 'tips' | 'middle' | 'core'>

// A gentle crawl, selected as prototype option 14: 96 frames, 80 ms apart, one turn in 7.68 s.
const frameMs = 80
const frames = 96

/**
 * Fire wrapping a pin or cluster reaching this far, including its outline. The image id carries its
 * geometry and colors, so changing the theme asks for a new image. Animation updates its pixels,
 * keeping a single image per size and color rather than filling the atlas with animation frames.
 */
export function flameImage(theme: Theme, { size, width, opacity, glowOpacity }: FireOutline, reach: number): string {
  const { tips, middle, core } = theme.components.ScoreCard.flames
  return ['flame', reach, size, width, opacity, glowOpacity, tips, middle, core].join('|')
}

/** Draws fire images as the map needs them; used images schedule their next animation frame. */
export function drawFlamesOnDemand(map: MapLibreMap): void {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
  const repaint = () => map.triggerRepaint()
  reducedMotion.addEventListener('change', repaint)
  map.on('remove', () => reducedMotion.removeEventListener('change', repaint))
  map.setMissingStyleImageResolver((id) => {
    const [kind, reach, size, width, opacity, glowOpacity, tips, middle, core] = id.split('|')
    if (kind !== 'flame' || map.hasImage(id)) return
    const pixelRatio = window.devicePixelRatio || 1
    const image = fireImage(Number(reach), {
      size: Number(size), width: Number(width), opacity: Number(opacity), glowOpacity: Number(glowOpacity),
    }, { tips, middle, core }, pixelRatio, reducedMotion, repaint)
    if (image) map.addImage(id, image, { pixelRatio })
  })
}

/** A thin, slowly turning fire outline and a steady glow, centered behind the pin or cluster. */
function fireImage(reach: number, outline: FireOutline, { tips, middle, core }: FireColors, pixelRatio: number, reducedMotion: MediaQueryList, repaint: () => void): StyleImageInterface | null {
  const half = Math.ceil(reach + Math.max(outline.size * 2.5, outline.width) + 2)
  const side = Math.max(1, Math.round(2 * half * pixelRatio))
  const canvas = document.createElement('canvas')
  canvas.width = side
  canvas.height = side
  const context = canvas.getContext('2d')
  if (!context) return null

  const draw = (frame: number) => {
    context.clearRect(0, 0, side, side)
    context.save()
    context.scale(pixelRatio, pixelRatio)
    context.translate(half, half)
    const radius = reach + outline.size
    if (outline.size > 0) {
      const glow = context.createRadialGradient(0, 0, reach * 0.6, 0, 0, radius)
      glow.addColorStop(0, middle)
      glow.addColorStop(1, 'transparent')
      context.globalAlpha = outline.glowOpacity
      context.fillStyle = glow
      context.beginPath()
      context.arc(0, 0, radius, 0, 2 * Math.PI)
      context.fill()
    }
    if (outline.width > 0) {
      const ring = context.createConicGradient(frame / frames * 2 * Math.PI, 0, 0)
      ring.addColorStop(0, core)
      ring.addColorStop(0.2, tips)
      ring.addColorStop(0.55, middle)
      ring.addColorStop(0.7, tips)
      ring.addColorStop(1, core)
      context.strokeStyle = ring
      context.globalAlpha = outline.opacity
      context.lineWidth = outline.width
      context.beginPath()
      context.arc(0, 0, reach, 0, 2 * Math.PI)
      context.stroke()
    }
    context.restore()
    return context.getImageData(0, 0, side, side).data
  }

  let previous = 0
  let timer: ReturnType<typeof setTimeout> | undefined
  const image: StyleImageInterface = {
    width: side,
    height: side,
    data: draw(0),
    render() {
      // Only images actually used in the current view reach render. Once hidden, an image's last
      // scheduled repaint runs and nothing schedules another. Reduced motion needs no timer.
      if (!reducedMotion.matches && timer === undefined) {
        timer = setTimeout(() => { timer = undefined; repaint() }, frameMs)
      }
      const frame = reducedMotion.matches ? 0 : Math.floor(performance.now() / frameMs) % frames
      if (frame === previous) return false
      previous = frame
      image.data = draw(frame)
      return true
    },
    onRemove() {
      clearTimeout(timer)
      timer = undefined
    },
  }
  return image
}
