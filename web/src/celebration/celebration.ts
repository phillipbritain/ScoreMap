/**
 * Draws a game's celebration as it finishes (see GLOSSARY.md "Celebration"): confetti over its score
 * card, and a fireworks show inside its event panel. Each plays on a canvas of its own inside what it
 * celebrates, so it's kept to it (clipped to its box), moves with it, and sits where it does among
 * everything else on the page: a card's under the event panel and the rail. With the device's reduce
 * motion setting on, nothing plays.
 */

/** A piece of confetti, a firework's rocket or one of its sparks, in its canvas's own px. */
interface Piece {
  kind: 'confetti' | 'rocket' | 'spark'
  x: number
  y: number
  vx: number
  vy: number
  /** Speed kept each frame at 60 fps, and gravity, px per frame per frame. */
  drag: number
  gravity: number
  size: number
  color: string
  /** Confetti's shape, turn and flutter. */
  shape: 'rect' | 'circle'
  angle: number
  spin: number
  wobble: number
  wobbleSpeed: number
  /** When it shows (performance.now()), and for how long, ms. */
  born: number
  life: number
  /** What it leaves as its life ends: a rocket, its burst's sparks. */
  onEnd?: (piece: Piece) => Piece[]
}

/** One celebration: its canvas, where the canvas goes each frame, and its pieces. */
interface Celebration {
  canvas: HTMLCanvasElement
  context: CanvasRenderingContext2D
  /** Sizes and places the canvas for this frame, returning its size; null once what it's for is gone. */
  place: () => { width: number; height: number } | null
  pieces: Piece[]
}

const celebrations = new Set<Celebration>()
let running = false

const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
const pick = <T>(items: readonly T[]): T => items[Math.floor(Math.random() * items.length)]

/** Starts a celebration on a new canvas in `host`; the frame loop sizes, draws and finally removes it. */
function start(host: HTMLElement, className: string, place: (canvas: HTMLCanvasElement) => { width: number; height: number } | null, pieces: Piece[]): void {
  const canvas = document.createElement('canvas')
  canvas.className = className
  canvas.setAttribute('aria-hidden', 'true')
  host.append(canvas)
  celebrations.add({ canvas, context: canvas.getContext('2d')!, place: () => place(canvas), pieces })
  if (running) return
  running = true
  let last = performance.now()
  const frame = (time: number) => {
    const step = Math.min(3, (time - last) / (1000 / 60))
    last = time
    for (const celebration of celebrations) {
      if (!draw(celebration, time, step)) {
        celebration.canvas.remove()
        celebrations.delete(celebration)
      }
    }
    if (celebrations.size) requestAnimationFrame(frame)
    else running = false
  }
  requestAnimationFrame(frame)
}

/** Draws a celebration's frame; false once it's over, or what it's for has gone. */
function draw(celebration: Celebration, time: number, step: number): boolean {
  const { canvas, context } = celebration
  const size = canvas.isConnected ? celebration.place() : null
  if (!size || size.width === 0) return false
  // Sized in CSS px, not to a viewport unit: on iOS Safari 100vh is taller than the window while its
  // toolbar shows, which would stretch a canvas and draw everything lower than it should be.
  const ratio = window.devicePixelRatio
  const [width, height] = [Math.ceil(size.width * ratio), Math.ceil(size.height * ratio)]
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width
    canvas.height = height
    canvas.style.width = `${size.width}px`
    canvas.style.height = `${size.height}px`
  }
  context.setTransform(ratio, 0, 0, ratio, 0, 0)
  context.clearRect(0, 0, size.width, size.height)

  const ended = celebration.pieces.filter((piece) => time - piece.born >= piece.life)
  celebration.pieces = celebration.pieces.filter((piece) => time - piece.born < piece.life)
  for (const piece of ended) celebration.pieces.push(...(piece.onEnd?.(piece) ?? []))
  for (const piece of celebration.pieces) {
    if (time < piece.born) continue
    const drag = Math.pow(piece.drag, step)
    piece.vx *= drag
    piece.vy = piece.vy * drag + piece.gravity * step
    piece.wobble += piece.wobbleSpeed * step
    piece.angle += piece.spin * step
    piece.x += (piece.vx + (piece.kind === 'confetti' ? Math.sin(piece.wobble) * 0.25 : 0)) * step
    piece.y += piece.vy * step
    const age = (time - piece.born) / piece.life
    context.save()
    if (piece.kind === 'confetti') drawConfetti(context, piece, age)
    else drawFirework(context, piece, age, time)
    context.restore()
  }
  return celebration.pieces.length > 0
}

function drawConfetti(context: CanvasRenderingContext2D, piece: Piece, age: number): void {
  context.globalAlpha = age < 0.7 ? 1 : 1 - (age - 0.7) / 0.3
  context.fillStyle = piece.color
  context.translate(piece.x, piece.y)
  context.rotate(piece.angle)
  // Turning over: the piece narrows and widens as it flutters.
  context.scale(1, Math.cos(piece.wobble * 1.7))
  if (piece.shape === 'circle') {
    context.beginPath()
    context.arc(0, 0, piece.size / 2.4, 0, Math.PI * 2)
    context.fill()
  } else {
    context.fillRect(-piece.size / 2, -piece.size / 3, piece.size, piece.size * 0.66)
  }
}

function drawFirework(context: CanvasRenderingContext2D, piece: Piece, age: number, time: number): void {
  context.globalCompositeOperation = 'lighter'
  context.strokeStyle = piece.color
  context.fillStyle = piece.color
  context.lineCap = 'round'
  if (piece.kind === 'rocket') {
    // A bright head with a short fading tail.
    context.globalAlpha = 0.5
    context.lineWidth = piece.size * 0.6
    context.beginPath()
    context.moveTo(piece.x, piece.y)
    context.lineTo(piece.x - piece.vx * 4, piece.y - piece.vy * 4)
    context.stroke()
    context.globalAlpha = 1
    context.beginPath()
    context.arc(piece.x, piece.y, piece.size * 0.55, 0, Math.PI * 2)
    context.fill()
    return
  }
  // A spark: a streak along its way, fading and twinkling as it dies.
  const twinkle = age > 0.6 ? 0.55 + 0.45 * Math.sin(time / 30 + piece.wobble) : 1
  context.globalAlpha = Math.max(0, (age < 0.55 ? 1 : 1 - (age - 0.55) / 0.45) * twinkle)
  context.lineWidth = piece.size
  context.beginPath()
  context.moveTo(piece.x, piece.y)
  context.lineTo(piece.x - piece.vx * 2.5, piece.y - piece.vy * 2.5)
  context.stroke()
}

// --- Confetti over a score card -------------------------------------------------------------------

/** How far a card's confetti may stray past the card's edges, px. */
const cardOverflow = 3
/** How many pieces, and how long they last, ms. */
const cardConfetti = { count: 34, duration: 2800 }

/**
 * Confetti over a score card that just finished, in `colors`: a small shower kept to the card. Pieces
 * pop out along its very top edge and drift down through it, more falling in from its top over the
 * first half of the time. On a canvas in the card's marker (`marker`), over the card, so it goes with
 * the card, and the event panel and the rail lie over it.
 */
export function confettiOnCard(card: HTMLElement, marker: HTMLElement, colors: readonly string[]): void {
  if (reduceMotion() || !colors.length || card.offsetWidth === 0) return
  const { offsetWidth: width } = card
  const now = performance.now()
  const pieces: Piece[] = []
  for (let i = 0; i < cardConfetti.count; i++) {
    const direction = Math.random() * Math.PI * 2
    const speed = 0.4 + Math.random() * 1.6
    const late = i > cardConfetti.count * 0.45
    pieces.push({
      kind: 'confetti',
      x: cardOverflow + Math.random() * width,
      y: cardOverflow + (late ? -4 : -1 + Math.random() * 3),
      vx: Math.sin(direction) * speed,
      vy: late ? 0.3 : -Math.abs(Math.cos(direction)) * speed - 0.6,
      drag: 0.96,
      gravity: 0.025,
      size: 3 + Math.random() * 2.5,
      color: pick(colors),
      shape: pick(['rect', 'rect', 'circle'] as const),
      angle: Math.random() * Math.PI * 2,
      spin: (Math.random() - 0.5) * 0.3,
      wobble: Math.random() * Math.PI * 2,
      wobbleSpeed: 0.05 + Math.random() * 0.1,
      born: now + (late ? Math.random() * cardConfetti.duration * 0.5 : 0),
      life: cardConfetti.duration * (0.6 + Math.random() * 0.4),
    })
  }
  // Over the card where it is in its marker (it glides within it as the card layout moves it).
  start(marker, 'score-card-celebration', (canvas) => {
    if (!card.isConnected || !marker.isConnected) return null
    const [cardBox, markerBox] = [card.getBoundingClientRect(), marker.getBoundingClientRect()]
    canvas.style.left = `${cardBox.left - markerBox.left - cardOverflow}px`
    canvas.style.top = `${cardBox.top - markerBox.top - cardOverflow}px`
    return { width: card.offsetWidth + 2 * cardOverflow, height: card.offsetHeight + 2 * cardOverflow }
  }, pieces)
}

// --- Fireworks in the event panel ------------------------------------------------------------------

/** The show: how many rockets, over how long (ms), the sparks in each burst and how long they last (ms). */
const panelFireworks = { rockets: 6, over: 1800, sparks: 55, duration: 1700 }

/**
 * A fireworks show inside the event panel, in `colors` lifted toward white so they glow: rockets from
 * along its foot, one after another, each bursting into a ring of sparks between a fifth and half of
 * the way down it. On a canvas filling the panel, so it's kept to it, moves with it, and goes with it.
 */
export function fireworksInPanel(panel: HTMLElement, colors: readonly string[]): void {
  if (reduceMotion() || !colors.length || panel.offsetWidth === 0) return
  const glowing = colors.map((color) => lifted(color, 0.35))
  const { offsetWidth: width, offsetHeight: height } = panel
  // A burst's reach is about 16 times its sparks' speed (drag 0.94 a frame): a third of the panel's height.
  const sparkSpeed = height / 48
  const now = performance.now()
  const pieces: Piece[] = []
  const burst = (rocket: Piece): Piece[] => {
    const sparks: Piece[] = []
    const main = pick(glowing)
    const turn = Math.random() * Math.PI * 2
    const speed = sparkSpeed * (0.85 + Math.random() * 0.3)
    for (let i = 0; i < panelFireworks.sparks; i++) {
      const direction = turn + (i / panelFireworks.sparks) * Math.PI * 2 + (Math.random() - 0.5) * 0.15
      // Most on the ring's edge, some inside it, so it reads as a sphere.
      const reach = speed * (Math.random() < 0.7 ? 0.9 + Math.random() * 0.15 : 0.35 + Math.random() * 0.5)
      sparks.push({
        kind: 'spark',
        x: rocket.x,
        y: rocket.y,
        vx: Math.cos(direction) * reach,
        vy: Math.sin(direction) * reach,
        drag: 0.94,
        gravity: 0.012,
        size: 2.2 * (0.7 + Math.random() * 0.5),
        color: Math.random() < 0.8 ? main : pick(glowing),
        shape: 'circle',
        angle: 0,
        spin: 0,
        wobble: Math.random() * Math.PI * 2,
        wobbleSpeed: 0,
        born: performance.now(),
        life: panelFireworks.duration * (0.75 + Math.random() * 0.25),
      })
    }
    return sparks
  }
  for (let i = 0; i < panelFireworks.rockets; i++) {
    const frames = 30 + Math.random() * 10
    // What a launch speed covers in that many frames, at drag 0.97 a frame.
    const travel = (1 - Math.pow(0.97, frames)) / 0.03
    const from = height - 6
    const rise = from - height * (0.2 + Math.random() * 0.3)
    pieces.push({
      kind: 'rocket',
      // Spread along the foot, by the golden ratio, so no two go up close together.
      x: width * (0.12 + 0.76 * ((i * 0.618) % 1)),
      y: from,
      vx: ((Math.random() - 0.5) * 40) / travel,
      vy: -rise / travel,
      drag: 0.97,
      gravity: 0,
      size: 3.5,
      color: '#fff3d6',
      shape: 'circle',
      angle: 0,
      spin: 0,
      wobble: 0,
      wobbleSpeed: 0,
      born: now + (i / (panelFireworks.rockets - 1)) * panelFireworks.over + Math.random() * 120,
      life: (frames * 1000) / 60,
      onEnd: burst,
    })
  }
  start(panel, 'event-panel__celebration', () => (panel.isConnected ? { width: panel.offsetWidth, height: panel.offsetHeight } : null), pieces)
}

/** A color (`#rrggbb` or `rgb(r g b)`) lifted toward white by `amount` (0 to 1); others as they are. */
export function lifted(color: string, amount: number): string {
  const hex = /^#([0-9a-f]{6})$/i.exec(color)
  const rgb = /^rgb\((\d+) (\d+) (\d+)\)$/.exec(color)
  const parts = hex ? [0, 2, 4].map((i) => parseInt(hex[1].slice(i, i + 2), 16)) : rgb ? rgb.slice(1, 4).map(Number) : null
  if (!parts) return color
  const [r, g, b] = parts.map((part) => Math.round(part + (255 - part) * amount))
  return `rgb(${r} ${g} ${b})`
}
