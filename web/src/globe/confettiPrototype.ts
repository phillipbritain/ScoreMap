// PROTOTYPE, throw away: confetti when a game ends, on its score card and in its game panel, and the
// game panel then closing itself (?confettiProto=A..D, a floating bar, [ and ] cycle). Local runs only.
//
// Four variants of density, colors, duration and the panel's close; with prefers-reduced-motion, no
// confetti and the panel closes with a plain fade.
import type { Game } from '../games/game'
import { pickableColors } from '../settings/gameColor'

export type CloseLook = 'fade' | 'slide' | 'shrink' | 'fold'
type Palette = 'game' | 'team' | 'party' | 'gold'
type Shape = 'rect' | 'circle' | 'streamer'

export interface ConfettiVariant {
  key: string
  name: string
  /** Pieces per bottom corner of the game panel. */
  panelCount: number
  /** Pieces over a score card (or pin). */
  cardCount: number
  palette: Palette
  shapes: readonly Shape[]
  /** How long a piece lives, in ms. */
  duration: number
  /** Launch speed, px per frame at 60 fps. */
  speed: number
  /** From the finish to the panel starting to close, in ms. */
  closeAfter: number
  close: CloseLook
}

export const confettiVariants: readonly ConfettiVariant[] = [
  { key: 'A', name: 'Sprinkle, game color · fade', panelCount: 40, cardCount: 18, palette: 'game', shapes: ['rect', 'circle'], duration: 1800, speed: 13, closeAfter: 2600, close: 'fade' },
  { key: 'B', name: 'Team colors · slide down', panelCount: 90, cardCount: 34, palette: 'team', shapes: ['rect', 'rect', 'circle'], duration: 2800, speed: 16, closeAfter: 3500, close: 'slide' },
  { key: 'C', name: 'Party · shrink into the pin', panelCount: 170, cardCount: 60, palette: 'party', shapes: ['rect', 'circle', 'streamer'], duration: 3600, speed: 19, closeAfter: 4200, close: 'shrink' },
  { key: 'D', name: 'Streamers, gold · fold away', panelCount: 60, cardCount: 24, palette: 'gold', shapes: ['streamer', 'streamer', 'rect'], duration: 2600, speed: 17, closeAfter: 3200, close: 'fold' },
]

const param = 'confettiProto'
const listeners = new Set<() => void>()

export function confettiVariant(): ConfettiVariant {
  const key = new URLSearchParams(location.search).get(param)
  return confettiVariants.find((variant) => variant.key === key) ?? confettiVariants[0]
}

export function setConfettiVariant(key: string): void {
  const url = new URL(location.href)
  url.searchParams.set(param, key)
  history.replaceState(history.state, '', url)
  for (const listener of listeners) listener()
}

export function onConfettiPrototypeChange(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches

// --- Colors ---------------------------------------------------------------------------------------

const logoColors = new Map<string, Promise<string[]>>()

/** A logo's two most common strong colors, sampled from a copy loaded for CORS (ESPN's CDN allows it). */
function colorsOfLogo(url: string): Promise<string[]> {
  let found = logoColors.get(url)
  if (found) return found
  found = new Promise<string[]>((resolve) => {
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
        const { data } = context.getImageData(0, 0, size, size)
        const counts = new Map<string, number>()
        for (let i = 0; i < data.length; i += 4) {
          if (data[i + 3] < 200) continue
          const [r, g, b] = [data[i], data[i + 1], data[i + 2]]
          const max = Math.max(r, g, b)
          const min = Math.min(r, g, b)
          // Skip near-white, near-black and gray: they're outlines and backgrounds, not the team's color.
          if (max - min < 40 || max < 40) continue
          const key = `${r >> 4},${g >> 4},${b >> 4}`
          counts.set(key, (counts.get(key) ?? 0) + 1)
        }
        const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2)
        resolve(top.map(([key]) => {
          const [r, g, b] = key.split(',').map((n) => Number(n) * 16 + 8)
          return `rgb(${r} ${g} ${b})`
        }))
      } catch {
        resolve([])
      }
    }
    image.src = url
  })
  logoColors.set(url, found)
  return found
}

const gold = ['#f3ca81', '#d4ac63', '#ffe7b0', '#ffffff', '#e58b55']

/** The colors a game's confetti takes, in this variant. */
export async function confettiColors(variant: ConfettiVariant, game: Game, gameColor: string): Promise<string[]> {
  switch (variant.palette) {
    case 'game':
      return [gameColor, gameColor, '#ffffff', '#f3ca81']
    case 'gold':
      return gold
    case 'party':
      return pickableColors
    case 'team': {
      const contest = game.contest
      const logos = contest.kind === 'sides' ? [contest.home.logoUrl, contest.away.logoUrl].filter((url): url is string => !!url) : []
      const colors = (await Promise.all(logos.map(colorsOfLogo))).flat()
      return colors.length ? [...colors, '#ffffff'] : [gameColor, '#ffffff']
    }
  }
}

// --- The confetti itself --------------------------------------------------------------------------

interface Piece {
  x: number
  y: number
  vx: number
  vy: number
  angle: number
  spin: number
  wobble: number
  wobbleSpeed: number
  size: number
  color: string
  shape: Shape
  born: number
  life: number
  /** For confetti kept to a score card: the card's box, read each frame, which the piece's x and y are from and it's clipped to; null once the card's gone. */
  within?: () => DOMRect | null
  /** Its gravity, px per frame per frame at 60 fps. */
  gravity: number
}

/** How far confetti kept to a card may stray past its edges, px. */
const cardOverflow = 3

let canvas: HTMLCanvasElement | null = null
let pieces: Piece[] = []
let running = false

function ensureCanvas(): CanvasRenderingContext2D {
  if (!canvas) {
    canvas = document.createElement('canvas')
    canvas.className = 'confetti-prototype__canvas'
    document.body.append(canvas)
  }
  const ratio = devicePixelRatio
  if (canvas.width !== innerWidth * ratio || canvas.height !== innerHeight * ratio) {
    canvas.width = innerWidth * ratio
    canvas.height = innerHeight * ratio
  }
  const context = canvas.getContext('2d')!
  context.setTransform(ratio, 0, 0, ratio, 0, 0)
  return context
}

export interface Blast {
  /** Where it goes off, on the page. */
  x: number
  y: number
  /** Its direction, degrees clockwise from straight up. */
  angle: number
  /** How far either side of it pieces go, degrees. */
  spread: number
  count: number
  colors: readonly string[]
  /** Scales the variant's launch speed. */
  power?: number
}

/** Fires a blast of the variant's confetti. Nothing with prefers-reduced-motion. */
export function blast(variant: ConfettiVariant, { x, y, angle, spread, count, colors, power = 1 }: Blast): void {
  if (reducedMotion() || !colors.length) return
  const now = performance.now()
  for (let i = 0; i < count; i++) {
    const direction = ((angle + (Math.random() * 2 - 1) * spread) * Math.PI) / 180
    const speed = variant.speed * power * (0.55 + Math.random() * 0.6)
    pieces.push({
      x,
      y,
      vx: Math.sin(direction) * speed,
      vy: -Math.cos(direction) * speed,
      angle: Math.random() * Math.PI * 2,
      spin: (Math.random() - 0.5) * 0.4,
      wobble: Math.random() * Math.PI * 2,
      wobbleSpeed: 0.05 + Math.random() * 0.1,
      size: 5 + Math.random() * 5,
      color: colors[Math.floor(Math.random() * colors.length)],
      shape: variant.shapes[Math.floor(Math.random() * variant.shapes.length)],
      born: now,
      life: variant.duration * (0.7 + Math.random() * 0.3),
      gravity: 0.32,
    })
  }
  run(now)
}

/**
 * A shower of the variant's confetti kept to a score card: pieces pop out a little inside it and drift
 * down through it, clipped to its box (a few px past its edges at most) and moving with it. Nothing
 * with prefers-reduced-motion.
 */
export function shower(variant: ConfettiVariant, card: HTMLElement, colors: readonly string[]): void {
  if (reducedMotion() || !colors.length) return
  const box = () => (card.isConnected ? card.getBoundingClientRect() : null)
  const start = box()
  if (!start || start.width === 0) return
  const now = performance.now()
  for (let i = 0; i < variant.cardCount; i++) {
    const direction = Math.random() * Math.PI * 2
    const speed = 0.4 + Math.random() * 1.6
    // Later pieces come in from the top edge, so it keeps falling through the card for a while.
    const late = i > variant.cardCount * 0.45
    pieces.push({
      x: Math.random() * start.width,
      y: late ? -4 : start.height * (0.15 + Math.random() * 0.5),
      vx: Math.sin(direction) * speed,
      vy: late ? 0.3 : -Math.abs(Math.cos(direction)) * speed - 0.6,
      angle: Math.random() * Math.PI * 2,
      spin: (Math.random() - 0.5) * 0.3,
      wobble: Math.random() * Math.PI * 2,
      wobbleSpeed: 0.05 + Math.random() * 0.1,
      size: 3 + Math.random() * 2.5,
      color: colors[Math.floor(Math.random() * colors.length)],
      shape: variant.shapes[Math.floor(Math.random() * variant.shapes.length)],
      born: now + (late ? Math.random() * variant.duration * 0.5 : 0),
      life: variant.duration * (0.6 + Math.random() * 0.4),
      within: box,
      gravity: 0.025,
    })
  }
  run(now)
}

function run(now: number): void {
  if (!running) {
    running = true
    let last = now
    const frame = (time: number) => {
      const step = Math.min(3, (time - last) / (1000 / 60))
      last = time
      const context = ensureCanvas()
      context.clearRect(0, 0, innerWidth, innerHeight)
      pieces = pieces.filter((piece) => time - piece.born < piece.life)
      // Each card's box once a frame.
      const boxes = new Map<() => DOMRect | null, DOMRect | null>()
      for (const piece of pieces) {
        if (time < piece.born) continue
        let origin = { x: 0, y: 0 }
        if (piece.within) {
          if (!boxes.has(piece.within)) boxes.set(piece.within, piece.within())
          const box = boxes.get(piece.within)
          if (!box || box.width === 0) {
            piece.life = 0
            continue
          }
          origin = { x: box.left, y: box.top }
          context.save()
          context.beginPath()
          context.rect(box.left - cardOverflow, box.top - cardOverflow, box.width + 2 * cardOverflow, box.height + 2 * cardOverflow)
          context.clip()
        }
        piece.vx *= Math.pow(0.96, step)
        piece.vy = piece.vy * Math.pow(0.96, step) + piece.gravity * step
        piece.wobble += piece.wobbleSpeed * step
        piece.angle += piece.spin * step
        piece.x += (piece.vx + Math.sin(piece.wobble) * (piece.within ? 0.25 : 0.8)) * step
        piece.y += piece.vy * step
        const age = (time - piece.born) / piece.life
        context.globalAlpha = age < 0.7 ? 1 : 1 - (age - 0.7) / 0.3
        context.fillStyle = piece.color
        context.save()
        context.translate(origin.x + piece.x, origin.y + piece.y)
        context.rotate(piece.angle)
        // Turning over: the piece narrows and widens as it flutters.
        context.scale(1, Math.cos(piece.wobble * 1.7))
        if (piece.shape === 'circle') {
          context.beginPath()
          context.arc(0, 0, piece.size / 2.4, 0, Math.PI * 2)
          context.fill()
        } else if (piece.shape === 'streamer') {
          context.fillRect(-piece.size * 0.18, -piece.size * 1.4, piece.size * 0.36, piece.size * 2.8)
        } else {
          context.fillRect(-piece.size / 2, -piece.size / 3, piece.size, piece.size * 0.66)
        }
        context.restore()
        if (piece.within) context.restore()
      }
      context.globalAlpha = 1
      if (pieces.length) requestAnimationFrame(frame)
      else running = false
    }
    requestAnimationFrame(frame)
  }
}

// --- Where it goes off ----------------------------------------------------------------------------

/** Confetti over a game that just finished on the globe: from the top of its score card, or its pin. */
export async function celebrateOnGlobe(game: Game, gameColor: string, card: HTMLElement | undefined, pin: { x: number; y: number } | null): Promise<void> {
  const variant = confettiVariant()
  const colors = await confettiColors(variant, game, gameColor)
  const box = card?.isConnected ? card.getBoundingClientRect() : null
  if (card && box && box.width > 0) shower(variant, card, colors)
  // No card: a small pop at the pin, kept close to it.
  else if (pin) blast(variant, { ...pin, angle: 0, spread: 40, count: Math.round(variant.cardCount / 2), colors, power: 0.25 })
}

/** Confetti up from both bottom corners of the game panel. */
export async function celebrateInPanel(panel: HTMLElement, game: Game, gameColor: string): Promise<void> {
  const variant = confettiVariant()
  const colors = await confettiColors(variant, game, gameColor)
  const box = panel.getBoundingClientRect()
  const phone = innerWidth <= 640
  const spread = 18
  blast(variant, { x: box.left + 6, y: box.bottom - 6, angle: phone ? 18 : 28, spread, count: variant.panelCount, colors, power: phone ? 1.5 : 1.8 })
  blast(variant, { x: box.right - 6, y: box.bottom - 6, angle: phone ? -18 : -28, spread, count: variant.panelCount, colors, power: phone ? 1.5 : 1.8 })
}
