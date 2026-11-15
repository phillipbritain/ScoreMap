import type { Game } from '../games/game'

/**
 * A logo's strongest colors, most common first, from its pixels (RGBA, as a canvas gives them): colors
 * near white, black or gray are left out, as a logo's outlines and backgrounds rather than its team's
 * colors, as are pixels mostly see-through. Alike colors count together. At most `count`.
 */
export function strongColors(pixels: Uint8ClampedArray, count = 2): string[] {
  const counts = new Map<number, number>()
  for (let i = 0; i < pixels.length; i += 4) {
    if (pixels[i + 3] < 200) continue
    const [r, g, b] = [pixels[i], pixels[i + 1], pixels[i + 2]]
    const max = Math.max(r, g, b)
    if (max - Math.min(r, g, b) < 40 || max < 40) continue
    // Alike colors (the same in their top four bits) count as one.
    const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4)
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, count)
    .map(([key]) => `rgb(${((key >> 8) & 15) * 16 + 8} ${((key >> 4) & 15) * 16 + 8} ${(key & 15) * 16 + 8})`)
}

const fromLogos = new Map<string, Promise<string[]>>()

/** A logo's strongest colors, sampled from a copy loaded for CORS (ESPN's image server allows it); none if it can't be read. Each logo once. */
function logoColors(url: string): Promise<string[]> {
  let colors = fromLogos.get(url)
  if (colors) return colors
  colors = new Promise<string[]>((resolve) => {
    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.onerror = () => resolve([])
    image.onload = () => {
      try {
        const size = 32
        const canvas = document.createElement('canvas')
        canvas.width = canvas.height = size
        const context = canvas.getContext('2d', { willReadFrequently: true })!
        context.drawImage(image, 0, 0, size, size)
        resolve(strongColors(context.getImageData(0, 0, size, size).data))
      } catch {
        resolve([])
      }
    }
    image.src = url
  })
  fromLogos.set(url, colors)
  return colors
}

/**
 * The colors a game's celebration plays in: its two teams' colors, from their logos, and white; just
 * `gameColor` and white when there are no logos to read (a field, a fight card, or logos that won't load).
 */
export async function teamColors(game: Game, gameColor: string): Promise<string[]> {
  const { contest } = game
  const logos = contest.kind === 'sides' ? [contest.home.logoUrl, contest.away.logoUrl].filter((url): url is string => !!url) : []
  const colors = (await Promise.all(logos.map(logoColors))).flat()
  return [...(colors.length ? colors : [gameColor]), '#ffffff']
}
