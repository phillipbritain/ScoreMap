import { Map as MapLibreMap, Marker, setWorkerUrl, type StyleSpecification } from 'maplibre-gl'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '../index.css'
import { applyTheme } from '../theme/applyTheme'
import { builtInTheme } from '../theme/builtInTheme'
import { cardComingDuration } from './cardComings'
import { PlacedCard, type PlacedCardEvents } from './placedCard'
import type { TrailOnGlobe } from './trailLayer'

// MapLibre's default worker path doesn't survive Vite's bundling (see globeMap).
setWorkerUrl(workerUrl)
applyTheme(document.documentElement, builtInTheme)

/** Nothing to fetch: the card only needs a map to sit on. */
const plainStyle: StyleSpecification = {
  version: 8,
  sources: {},
  layers: [{ id: 'background', type: 'background', paint: { 'background-color': '#0b1526' } }],
}

let container: HTMLElement
let map: MapLibreMap

beforeEach(() => {
  container = document.createElement('div')
  container.style.cssText = 'position: relative; width: 400px; height: 300px'
  document.body.append(container)
  map = new MapLibreMap({ container, style: plainStyle, center: [0, 0], zoom: 3, attributionControl: false })
})

afterEach(() => {
  vi.restoreAllMocks()
  map.remove()
  container.remove()
})

const noEvents: PlacedCardEvents = { select: () => {}, hover: () => {} }

/** A card placed at the middle of the map, with something in it to focus. */
function place(events: PlacedCardEvents = noEvents) {
  const card = new PlacedCard(map, 'A', [0, 0], events)
  card.element.textContent = 'BUF 17 KC 21'
  return card
}

const trail: TrailOnGlobe = { gameId: 'A', color: '#ffffff', venue: [0, 0], start: { dx: 0, dy: -40 }, end: [0, 0], dot: true }

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/** Ends the pulse playing on the card, as the browser does when its animation finishes. */
const endAnimation = (element: Element, target: Element = element) =>
  target.dispatchEvent(new AnimationEvent('animationend', { bubbles: true }))

describe('a placed card', () => {
  it('tells its owner when it is selected or hovered by a mouse', () => {
    const events = { select: vi.fn(), hover: vi.fn() }
    const card = place(events)
    card.element.click()
    card.markerElement.dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'mouse' }))
    card.markerElement.dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'touch' }))
    card.markerElement.dispatchEvent(new PointerEvent('pointerleave', { pointerType: 'mouse' }))
    expect(events.select).toHaveBeenCalledOnce()
    expect(events.hover.mock.calls).toEqual([[true], [false]])
  })

  it('keeps a pulse through a redraw, until the pulse is over', () => {
    const card = place()
    card.pulse('score')
    expect(card.animation).toBe('score')
    // A redraw sets the card's classes afresh, from what it's drawn with (see drawScoreCard).
    card.element.className = 'score-card'
    expect(card.animation).toBe('score')
    // The score inside ends its own flash first: the card's pulse plays on.
    const score = document.createElement('span')
    card.element.append(score)
    endAnimation(card.element, score)
    expect(card.animation).toBe('score')
    endAnimation(card.element)
    expect(card.animation).toBeUndefined()
  })

  it('restarts a pulse played again, and ends only the latest', () => {
    const card = place()
    card.pulse('start')
    card.pulse('score')
    expect(card.element.classList.contains('score-card--animate-start')).toBe(false)
    expect(card.element.classList.contains('score-card--animate-score')).toBe(true)
    endAnimation(card.element)
    expect(card.animation).toBeUndefined()
    expect(card.element.classList.contains('score-card--animate-score')).toBe(false)
  })

  it('comes in, and is told once it is over', async () => {
    const card = place()
    const over = vi.fn()
    card.comeIn(over)
    expect(card.markerElement.classList.contains('score-card-coming')).toBe(true)
    await vi.waitFor(() => expect(over).toHaveBeenCalledOnce())
    card.cameIn()
    expect(card.markerElement.classList.contains('score-card-coming')).toBe(false)
  })

  it('goes out from partway in, as far in as it got, keeping its trail and taking no input meanwhile', async () => {
    const card = place()
    card.comeIn(() => {})
    card.element.focus()
    expect(document.activeElement).toBe(card.element)
    card.pulse('score')
    const over = vi.fn()
    const since = cardComingDuration - 100
    card.goOut(since, trail, over)

    expect(card.markerElement.classList.contains('score-card-coming')).toBe(false)
    expect(card.markerElement.classList.contains('score-card-going')).toBe(true)
    expect(card.markerElement.style.animationDelay).toBe(`${-since}ms`)
    expect(card.markerElement.inert).toBe(true)
    expect(card.markerElement.getAttribute('aria-hidden')).toBe('true')
    expect(card.element.contains(document.activeElement)).toBe(false)
    expect(card.animation).toBeUndefined()
    expect(card.trail).toBe(trail)
    // Only what's left of going out, not the whole of it.
    expect(over).not.toHaveBeenCalled()
    await pause(cardComingDuration - since + 60)
    expect(over).toHaveBeenCalledOnce()
    expect(card.markerElement.isConnected).toBe(true)
  })

  it('lets a new card come in while the old one, going out, is disposed: its game came back', async () => {
    const old = place()
    old.goOut(0, trail, () => {})
    const back = place()
    back.comeIn(() => {})
    old.dispose()
    expect(old.trail).toBeUndefined()
    expect(old.markerElement.isConnected).toBe(false)
    expect(back.markerElement.isConnected).toBe(true)
    expect(back.markerElement.classList.contains('score-card-coming')).toBe(true)
    expect(container.querySelectorAll('.maplibregl-marker')).toHaveLength(1)
  })

  it('is disposed with its coming in still pending, its owner still told when it would have been over', async () => {
    const card = place()
    const over = vi.fn()
    card.comeIn(over)
    card.dispose()
    expect(card.markerElement.isConnected).toBe(false)
    await vi.waitFor(() => expect(over).toHaveBeenCalledOnce())
    card.cameIn()
    expect(card.markerElement.isConnected).toBe(false)
  })

  it('sends focus back as it joins a card cluster, and shows again as it leaves one', () => {
    const card = place()
    card.element.focus()
    card.setInCardCluster(true)
    expect(card.markerElement.hasAttribute('data-in-card-cluster')).toBe(true)
    expect(document.activeElement).toBe(map.getCanvas())
    card.setInCardCluster(false)
    expect(card.markerElement.hasAttribute('data-in-card-cluster')).toBe(false)
  })

  describe('leaves the globe once, whichever way it leaves', () => {
    const exits: Record<string, (card: PlacedCard) => void> = {
      'no longer wanted': (card) => card.dispose(),
      'gone out': (card) => {
        card.goOut(0, trail, () => {})
        card.dispose()
      },
      'from a card cluster': (card) => {
        card.setInCardCluster(true)
        card.dispose()
      },
      'pulsing, its coming in pending': (card) => {
        card.comeIn(() => {})
        card.pulse('start')
        card.dispose()
      },
    }

    for (const [exit, leave] of Object.entries(exits)) {
      it(exit, () => {
        const card = place()
        // From now: placing a marker removes it from wherever it was first.
        const removed = vi.spyOn(Marker.prototype, 'remove')
        card.element.focus()
        leave(card)
        card.dispose()
        expect(removed).toHaveBeenCalledOnce()
        expect(card.markerElement.isConnected).toBe(false)
        expect(document.activeElement).toBe(map.getCanvas())
        expect(card.animation).toBeUndefined()
        expect(card.trail).toBeUndefined()
      })
    }
  })
})
