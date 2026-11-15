// PROTOTYPE, throw away: confetti when a game ends, on its score card and in its game panel, and the
// game panel then closing itself (?confettiProto=, a floating bar, [ and ] cycle). Local runs only.
//
// B, the confetti picked (team colors, then the panel slides down), against fireworks in its place (E,
// F) or with it (G), all in the teams' colors and closing as B does. A, C and D, the confetti not
// picked, are still there by URL. With prefers-reduced-motion, none of it.
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
  /** Confetti, fireworks in its place, or both. */
  effect?: 'confetti' | 'fireworks' | 'both'
  /** The panel's rockets: how many, over how long (ms), and the sparks in each burst. */
  rockets?: number
  rocketsOver?: number
  sparks?: number
  /** Where the panel's rockets go up from: its bottom corners, or along its top edge. */
  rocketsFrom?: 'corners' | 'top'
  /** The card's bursts, inside it. */
  cardBursts?: number
}

export const confettiVariants: readonly ConfettiVariant[] = [
  { key: 'A', name: 'Sprinkle, game color · fade', panelCount: 40, cardCount: 18, palette: 'game', shapes: ['rect', 'circle'], duration: 1800, speed: 13, closeAfter: 2600, close: 'fade' },
  { key: 'B', name: 'Team colors · slide down', panelCount: 90, cardCount: 34, palette: 'team', shapes: ['rect', 'rect', 'circle'], duration: 2800, speed: 16, closeAfter: 3500, close: 'slide' },
  { key: 'C', name: 'Party · shrink into the pin', panelCount: 170, cardCount: 60, palette: 'party', shapes: ['rect', 'circle', 'streamer'], duration: 3600, speed: 19, closeAfter: 4200, close: 'shrink' },
  { key: 'D', name: 'Streamers, gold · fold away', panelCount: 60, cardCount: 24, palette: 'gold', shapes: ['streamer', 'streamer', 'rect'], duration: 2600, speed: 17, closeAfter: 3200, close: 'fold' },
  { key: 'E', name: 'Fireworks: a rocket from each corner', panelCount: 0, cardCount: 0, palette: 'team', shapes: [], duration: 1600, speed: 0, closeAfter: 3300, close: 'slide', effect: 'fireworks', rockets: 2, rocketsOver: 250, sparks: 70, rocketsFrom: 'corners', cardBursts: 1 },
  { key: 'F', name: 'Fireworks show', panelCount: 0, cardCount: 0, palette: 'team', shapes: [], duration: 1700, speed: 0, closeAfter: 4200, close: 'slide', effect: 'fireworks', rockets: 6, rocketsOver: 1800, sparks: 55, rocketsFrom: 'top', cardBursts: 3 },
  { key: 'G', name: 'Confetti and fireworks', panelCount: 70, cardCount: 24, palette: 'team', shapes: ['rect', 'rect', 'circle'], duration: 2800, speed: 16, closeAfter: 3800, close: 'slide', effect: 'both', rockets: 3, rocketsOver: 900, sparks: 55, rocketsFrom: 'top', cardBursts: 1 },
]

/** The variants the bar cycles through: B, the confetti picked, and the fireworks against it. */
export const cycledVariants: readonly ConfettiVariant[] = confettiVariants.filter((variant) => 'BEFG'.includes(variant.key))

const param = 'confettiProto'
const listeners = new Set<() => void>()

export function confettiVariant(): ConfettiVariant {
  const key = new URLSearchParams(location.search).get(param)
  return confettiVariants.find((variant) => variant.key === key) ?? cycledVariants[0]
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
  /** A firework's spark (a glowing streak) or rocket (a bright dot); confetti otherwise. */
  kind?: 'spark' | 'rocket'
  /** Drag each frame at 60 fps: how much speed it keeps. */
  drag?: number
  /** What it does as its life ends: a rocket bursts. */
  onEnd?: (piece: Piece, origin: { x: number; y: number }) => void
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
  // Sized in px to the window as drawn in, not 100vh: on iOS Safari 100vh is taller than the window
  // while its toolbar shows, which would stretch the canvas and draw everything lower than it should be.
  canvas.style.width = `${innerWidth}px`
  canvas.style.height = `${innerHeight}px`
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
  /** A box to keep it to, read each frame: x and y are then in the box, and the pieces are clipped to it and move with it. */
  within?: () => DOMRect | null
}

/** Fires a blast of the variant's confetti. Nothing with prefers-reduced-motion. */
export function blast(variant: ConfettiVariant, { x, y, angle, spread, count, colors, power = 1, within }: Blast): void {
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
      within,
    })
  }
  run(now)
}

/**
 * A shower of the variant's confetti kept to a score card: pieces pop out along its very top edge and drift
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
      y: late ? -4 : -1 + Math.random() * 3,
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
      const ended = pieces.filter((piece) => time - piece.born >= piece.life && piece.onEnd)
      pieces = pieces.filter((piece) => time - piece.born < piece.life)
      for (const piece of ended) {
        const box = piece.within?.()
        piece.onEnd!(piece, box ? { x: box.left, y: box.top } : { x: 0, y: 0 })
      }
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
        if (piece.kind) {
          drawFirework(context, piece, origin, time, step)
          if (piece.within) context.restore()
          continue
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

// --- Fireworks -----------------------------------------------------------------------------------

function drawFirework(context: CanvasRenderingContext2D, piece: Piece, origin: { x: number; y: number }, time: number, step: number): void {
  const drag = Math.pow(piece.drag ?? 0.95, step)
  piece.vx *= drag
  piece.vy = piece.vy * drag + piece.gravity * step
  piece.x += piece.vx * step
  piece.y += piece.vy * step
  const age = (time - piece.born) / piece.life
  const x = origin.x + piece.x
  const y = origin.y + piece.y
  context.save()
  context.globalCompositeOperation = 'lighter'
  context.strokeStyle = piece.color
  context.fillStyle = piece.color
  context.lineCap = 'round'
  if (piece.kind === 'rocket') {
    // A bright head with a short fading tail.
    context.globalAlpha = 0.5
    context.lineWidth = piece.size * 0.6
    context.beginPath()
    context.moveTo(x, y)
    context.lineTo(x - piece.vx * 4, y - piece.vy * 4)
    context.stroke()
    context.globalAlpha = 1
    context.beginPath()
    context.arc(x, y, piece.size * 0.55, 0, Math.PI * 2)
    context.fill()
  } else {
    // A streak along its way, fading and twinkling as it dies.
    const twinkle = age > 0.6 ? 0.55 + 0.45 * Math.sin(time / 30 + piece.wobble) : 1
    context.globalAlpha = Math.max(0, (age < 0.55 ? 1 : 1 - (age - 0.55) / 0.45) * twinkle)
    context.lineWidth = piece.size
    context.beginPath()
    context.moveTo(x, y)
    context.lineTo(x - piece.vx * 2.5, y - piece.vy * 2.5)
    context.stroke()
  }
  context.restore()
}

interface Burst {
  /** Where, on the page, or in the card's box when `within` is given. */
  x: number
  y: number
  sparks: number
  colors: readonly string[]
  /** Spark speed, px per frame at 60 fps. */
  speed: number
  /** How long the sparks last, ms. */
  life: number
  size: number
  within?: () => DOMRect | null
  at?: number
}

/** A firework's burst: a ring of sparks, in one of the colors, with a few of another for depth. */
function burst({ x, y, sparks, colors, speed, life, size, within, at = performance.now() }: Burst): void {
  const main = colors[Math.floor(Math.random() * colors.length)]
  const turn = Math.random() * Math.PI * 2
  for (let i = 0; i < sparks; i++) {
    const direction = turn + (i / sparks) * Math.PI * 2 + (Math.random() - 0.5) * 0.15
    // Most on the ring's edge, some inside it, so it reads as a sphere.
    const reach = speed * (Math.random() < 0.7 ? 0.9 + Math.random() * 0.15 : 0.35 + Math.random() * 0.5)
    pieces.push({
      x, y,
      vx: Math.cos(direction) * reach,
      vy: Math.sin(direction) * reach,
      angle: 0, spin: 0,
      wobble: Math.random() * Math.PI * 2, wobbleSpeed: 0,
      size: size * (0.7 + Math.random() * 0.5),
      color: Math.random() < 0.8 ? main : colors[Math.floor(Math.random() * colors.length)],
      shape: 'circle',
      born: at,
      life: life * (0.75 + Math.random() * 0.25),
      gravity: within ? 0.012 : 0.05,
      drag: 0.94,
      kind: 'spark',
      within,
    })
  }
}

/**
 * A rocket going up inside the game panel, from (x, y) in its box, to burst `height` px above that after
 * `delay` ms, its sparks kept to the panel too (clipped to its box, and moving with it).
 */
function rocket(variant: ConfettiVariant, within: () => DOMRect | null, x: number, y: number, height: number, drift: number, colors: readonly string[], delay: number, sparkSpeed: number): void {
  const frames = 30 + Math.random() * 10
  // Drag 0.97 a frame: what a launch speed covers in that many frames.
  const travel = (1 - Math.pow(0.97, frames)) / 0.03
  const now = performance.now()
  pieces.push({
    x, y, vx: drift / travel, vy: -height / travel,
    angle: 0, spin: 0, wobble: 0, wobbleSpeed: 0,
    size: 3.5, color: '#fff3d6', shape: 'circle',
    born: now + delay,
    life: (frames * 1000) / 60,
    gravity: 0,
    drag: 0.97,
    kind: 'rocket',
    within,
    onEnd: (piece) => {
      burst({ x: piece.x, y: piece.y, sparks: variant.sparks ?? 60, colors, speed: sparkSpeed * (0.85 + Math.random() * 0.3), life: variant.duration, size: 2.2, within })
    },
  })
  run(now)
}

/**
 * Fireworks in the game panel, kept to it: rockets from its bottom corners, or from along its foot,
 * bursting inside it, over the variant's time.
 */
function panelFireworks(variant: ConfettiVariant, panel: HTMLElement, colors: readonly string[]): void {
  const within = () => (panel.isConnected ? panel.getBoundingClientRect() : null)
  const box = within()
  if (!box || box.width === 0) return
  const count = variant.rockets ?? 2
  // A burst's reach is about 16 times its spark speed (drag 0.94 a frame): about a third of the panel's height.
  const sparkSpeed = box.height / 48
  for (let i = 0; i < count; i++) {
    const delay = count === 1 ? 0 : (i / (count - 1)) * (variant.rocketsOver ?? 0) + Math.random() * 120
    // Bursting between a fifth and a half of the way down the panel.
    const burstAt = box.height * (0.2 + Math.random() * 0.3)
    const from = box.height - 6
    if (variant.rocketsFrom === 'corners') {
      const left = i % 2 === 0
      rocket(variant, within, left ? 10 : box.width - 10, from, from - burstAt, (left ? 1 : -1) * box.width * 0.18, colors, delay, sparkSpeed)
    } else {
      const x = box.width * (0.12 + 0.76 * ((i * 0.618) % 1))
      rocket(variant, within, x, from, from - burstAt, (Math.random() - 0.5) * 40, colors, delay, sparkSpeed)
    }
  }
}

/** Small bursts inside a score card, clipped to it, one after another. */
function cardFireworks(variant: ConfettiVariant, card: HTMLElement, colors: readonly string[]): void {
  const box = () => (card.isConnected ? card.getBoundingClientRect() : null)
  const start = box()
  if (!start || start.width === 0) return
  const now = performance.now()
  const count = variant.cardBursts ?? 1
  for (let i = 0; i < count; i++) {
    const x = count === 1 ? start.width / 2 : start.width * (0.25 + 0.5 * Math.random())
    const y = start.height * (0.3 + 0.25 * Math.random())
    burst({ x, y, sparks: 34, colors, speed: Math.min(start.width, start.height) / 12, life: 1200, size: 2.2, within: box, at: now + i * 420 })
  }
  run(now)
}

// --- Where it goes off ----------------------------------------------------------------------------

/** Confetti over a game that just finished on the globe: from the top of its score card, or its pin. */
export async function celebrateOnGlobe(game: Game, gameColor: string, card: HTMLElement | undefined, pin: { x: number; y: number } | null): Promise<void> {
  const variant = confettiVariant()
  const colors = await confettiColors(variant, game, gameColor)
  if (reducedMotion()) return
  const box = card?.isConnected ? card.getBoundingClientRect() : null
  const effect = variant.effect ?? 'confetti'
  if (card && box && box.width > 0) {
    if (effect !== 'fireworks') shower(variant, card, colors)
    if (effect !== 'confetti') cardFireworks(variant, card, glowing(colors, 0.55))
  }
  else if (pin && effect !== 'confetti') burst({ ...pin, sparks: 24, colors: glowing(colors), speed: 2.4, life: 1000, size: 1.6 })
  // No card: a small pop at the pin, kept close to it.
  else if (pin) blast(variant, { ...pin, angle: 0, spread: 40, count: Math.round(variant.cardCount / 2), colors, power: 0.25 })
}

/** Confetti up from both bottom corners of the game panel, kept to it; and its fireworks, in it too. */
export async function celebrateInPanel(panel: HTMLElement, game: Game, gameColor: string): Promise<void> {
  if (reducedMotion()) return
  const variant = confettiVariant()
  const colors = await confettiColors(variant, game, gameColor)
  // Kept to the panel: from just inside its bottom corners, reaching most of the way up it at the
  // fastest (a piece rises about 10.5 px per unit of launch speed, at drag 0.96 and gravity 0.32).
  const within = () => (panel.isConnected ? panel.getBoundingClientRect() : null)
  const box = within()
  if (!box || box.width === 0) return
  const power = variant.speed ? box.height / 14 / variant.speed : 1
  const spread = 18
  blast(variant, { x: 6, y: box.height - 4, angle: 22, spread, count: variant.panelCount, colors, power, within })
  blast(variant, { x: box.width - 6, y: box.height - 4, angle: -22, spread, count: variant.panelCount, colors, power, within })
  if ((variant.effect ?? 'confetti') !== 'confetti') panelFireworks(variant, panel, glowing(colors))
}

/**
 * Colors lifted toward white for fireworks, which glow: a team's navy would hardly show as light on the
 * navy globe.
 */
function glowing(colors: readonly string[], lift = 0.35): string[] {
  return colors.map((color) => {
    const hex = /^#([0-9a-f]{6})$/i.exec(color)
    const rgb = /^rgb\((\d+) (\d+) (\d+)\)$/.exec(color)
    const parts = hex ? [0, 2, 4].map((i) => parseInt(hex[1].slice(i, i + 2), 16)) : rgb ? rgb.slice(1, 4).map(Number) : null
    if (!parts) return color
    const [r, g, b] = parts.map((part) => Math.round(part + (255 - part) * lift))
    return `rgb(${r} ${g} ${b})`
  })
}
