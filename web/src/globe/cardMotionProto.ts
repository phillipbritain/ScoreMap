// PROTOTYPE, throwaway: ways to cut down how much score cards move as the camera pans and zooms.
// Picked with `?cardMotionProto=<variant>` and cycled with `[` and `]` (the switcher bar, dev runs
// only). The card layout calls the hooks below; with `today` they change nothing.
import type { CardPlacement, CardScene } from './cardLayout'

export const cardMotionVariants = ['today', 'hysteresis', 'nearby', 'hold', 'fold'] as const
export type CardMotionVariant = (typeof cardMotionVariants)[number]

export const cardMotionNames: Record<CardMotionVariant, string> = {
  today: 'Today',
  hysteresis: 'Hysteresis: put up with overlap while moving',
  nearby: 'Nearby: a card that must move goes to the room nearest where it was',
  hold: 'Hold: nothing moves until the camera stops',
  fold: 'Fold: hold, and fold a covered card into a cluster',
}

const param = 'cardMotionProto'

function fromUrl(): CardMotionVariant {
  if (typeof location === 'undefined') return 'today'
  const value = new URLSearchParams(location.search).get(param)
  return cardMotionVariants.includes(value as CardMotionVariant) ? (value as CardMotionVariant) : 'today'
}

let variant: CardMotionVariant = fromUrl()

export const cardMotionVariant = (): CardMotionVariant => variant

/** For the replay script, and the switcher. */
export function setCardMotionVariant(next: CardMotionVariant): void {
  variant = next
}

/** Whether the camera's moving, either way the scene says it. */
export const cameraInMotion = (scene: CardScene): boolean => scene.moving === true || scene.cameraMoving === true

// Hysteresis: how far a card may come into what it keeps clear of, or off screen, and keep where it
// was, while the camera moves. Today it's 4 px, moving or still.
const hysteresisDrift = 18

/** How far a card may drift into what it keeps clear of and keep where it was (arrange's `drift`). */
export function driftFor(scene: CardScene, drift: number): number {
  return variant === 'hysteresis' && cameraInMotion(scene) ? hysteresisDrift : drift
}

/** Nearby: whether a card that was moved and must move again takes the room nearest where it was. */
export function nearestToWhereItWas(scene: CardScene): boolean {
  return variant === 'nearby' && cameraInMotion(scene)
}

/**
 * Hold: while the camera moves, every card laid out last time keeps its offset and whether it's in a
 * card cluster; its trail moves with its venue. Gives the placement held, or undefined to lay it out.
 */
export function heldPlacement(scene: CardScene, was: CardPlacement | undefined, venueX: number, venueY: number): CardPlacement | undefined {
  if ((variant !== 'hold' && variant !== 'fold') || !cameraInMotion(scene) || !was) return undefined
  if (!was.trail) return { ...was }
  const dx = venueX - was.trail.x2
  const dy = venueY - was.trail.y2
  return { ...was, trail: { x1: was.trail.x1 + dx, y1: was.trail.y1 + dy, x2: venueX, y2: venueY } }
}

// Hold and fold: how much shorter, in pixels, a moved card's trail must get for it to move once the
// camera stops, as a spot held through a zoom can leave it far from its venue.
export const tidyTrail = 40

/** Hold and fold: whether a moved card that still fits looks for a spot with a much shorter trail. */
export function tidiesOnStop(scene: CardScene): boolean {
  return (variant === 'hold' || variant === 'fold') && !cameraInMotion(scene)
}

// Fold: how far, in pixels both ways, a held card may lie under another before it folds into a card cluster.
const foldOverlap = 8

/** One card as held, for folding: by rank, its bottom center on screen (venue plus offset) and its size. */
export interface HeldCard {
  gameId: string
  x: number
  y: number
  width: number
  height: number
}

/**
 * Fold: while the camera moves, of the cards shown (by rank, most prominent first), the games whose
 * cards lie under one ahead of them by more than foldOverlap both ways, to count in a card cluster
 * until it stops.
 */
export function foldedWhileMoving(scene: CardScene, cards: readonly HeldCard[]): Set<string> {
  const folded = new Set<string>()
  if (variant !== 'fold' || !cameraInMotion(scene)) return folded
  const kept: HeldCard[] = []
  for (const card of cards) {
    const under = kept.some(
      (other) =>
        Math.min(card.x + card.width / 2, other.x + other.width / 2) - Math.max(card.x - card.width / 2, other.x - other.width / 2) > foldOverlap &&
        Math.min(card.y, other.y) - Math.max(card.y - card.height, other.y - other.height) > foldOverlap,
    )
    if (under) folded.add(card.gameId)
    else kept.push(card)
  }
  return folded
}

/** The switcher bar, top center, clear of the bottom sheets: `[` and `]` cycle, in dev runs only. */
export function mountCardMotionSwitcher(onSwitch: () => void): void {
  if (!import.meta.env.DEV || typeof document === 'undefined' || document.getElementById('card-motion-proto')) return
  const bar = document.createElement('div')
  bar.id = 'card-motion-proto'
  bar.style.cssText =
    'position:fixed;top:8px;left:50%;transform:translateX(-50%);z-index:10000;display:flex;gap:6px;align-items:center;' +
    'max-width:calc(100vw - 120px);padding:4px 8px;border-radius:999px;background:#ff0;color:#000;' +
    'font:600 12px system-ui;box-shadow:0 2px 8px #0008;white-space:nowrap'
  const button = (text: string, by: number) => {
    const b = document.createElement('button')
    b.textContent = text
    b.style.cssText = 'all:unset;cursor:pointer;padding:0 6px;font-size:14px'
    b.onclick = () => cycle(by)
    return b
  }
  const label = document.createElement('span')
  label.style.cssText = 'overflow:hidden;text-overflow:ellipsis'
  bar.append(button('[', -1), label, button(']', 1))
  const show = () => {
    const index = cardMotionVariants.indexOf(variant)
    label.textContent = `${index + 1}/${cardMotionVariants.length} ${cardMotionNames[variant]}`
    label.title = cardMotionNames[variant]
  }
  const cycle = (by: number) => {
    const index = cardMotionVariants.indexOf(variant)
    variant = cardMotionVariants[(index + by + cardMotionVariants.length) % cardMotionVariants.length]
    const url = new URL(location.href)
    url.searchParams.set(param, variant)
    history.replaceState(history.state, '', url)
    show()
    onSwitch()
  }
  addEventListener('keydown', (event) => {
    const target = event.target as HTMLElement | null
    if (target?.closest('input, textarea, [contenteditable]')) return
    if (event.key === '[') cycle(-1)
    else if (event.key === ']') cycle(1)
  })
  show()
  document.body.append(bar)
}
