import type { Map as MapLibreMap, StyleSpecification } from 'maplibre-gl'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { userEvent } from 'vitest/browser'
import '../index.css'
import type { Game, GameStatus } from '../games/game'
import type { Camera } from './camera'
import { GlobeMap, selectedPinLayer } from './globeMap'
import { clusterLayer, smallPinLayer } from './pinLayers'
import { applyStatusLook } from './statusLook'
import { cardZoom, maxZoom } from './zoomLevels'

applyStatusLook(document.documentElement)

/**
 * A plain style with nothing to fetch: no tiles, no place names, and no glyphs, so cluster counts
 * aren't drawn (the tests look for the clusters themselves).
 */
const plainStyle: StyleSpecification = {
  version: 8,
  sources: {},
  layers: [{ id: 'background', type: 'background', paint: { 'background-color': '#0b1526' } }],
}

interface GameAt {
  longitude?: number
  latitude?: number
  status?: GameStatus
  home?: number | null
  away?: number | null
  clock?: string | null
}

function game(id: string, { longitude = 0, latitude = 0, status = 'Live', home = 0, away = 0, clock = null }: GameAt = {}): Game {
  return {
    id,
    league: 'NFL',
    sport: 'American football',
    startTime: '2026-10-04T17:00:00+00:00',
    status,
    delayed: false,
    disruption: null,
    endTime: null,
    home: { abbreviation: 'KC', fullName: 'Kansas City Chiefs', logoUrl: null, score: home },
    away: { abbreviation: 'BUF', fullName: 'Buffalo Bills', logoUrl: null, score: away },
    clock,
    period: null,
    venue: { name: null, city: null, country: null, latitude, longitude, timeZone: null, photo: null },
    broadcasters: [],
    streamLinks: [],
  }
}

const opened: GlobeMap[] = []
let container: HTMLElement

afterEach(() => {
  for (const globe of opened.splice(0)) globe.destroy()
  container?.remove()
})

/** Opens a globe on the page, 800 × 600, looking at the given place. */
function openGlobe(startCamera: Camera) {
  container = document.createElement('div')
  container.style.cssText = 'position: relative; width: 800px; height: 600px'
  document.body.append(container)
  const onSelect = vi.fn<(gameId: string) => void>()
  const onCameraMove = vi.fn<(camera: Camera) => void>()
  const globe = new GlobeMap(container, { style: plainStyle, startCamera, onSelect, onCameraMove })
  opened.push(globe)
  // MapLibre's own map, to see what it draws; the tests drive the globe only through GlobeMap.
  const map = (globe as unknown as { map: MapLibreMap }).map
  return { globe, map, onSelect, onCameraMove }
}

/**
 * What the map has drawn in a layer at a game's venue. Asked of a box around it: asked of no box or
 * the whole canvas, the globe projection leaves out circle layers.
 */
function drawnAt(map: MapLibreMap, layer: string, { venue }: Game) {
  // Nothing yet, until the style has loaded and the pins' layers are added.
  if (!map.getLayer(layer)) return []
  const { x, y } = map.project([venue.longitude, venue.latitude])
  return map.queryRenderedFeatures(
    [
      [x - 10, y - 10],
      [x + 10, y + 10],
    ],
    { layers: [layer] },
  )
}

/** Waits until the map has drawn these games' small pins, or the clusters they're in. */
async function pinsDrawn(map: MapLibreMap, layer: string, ...games: Game[]) {
  await vi.waitFor(() => expect(games.every((game) => drawnAt(map, layer, game).length > 0)).toBe(true), {
    timeout: 10_000,
  })
}

const card = (gameId: string) => container.querySelector<HTMLElement>(`.score-card[data-game-id="${gameId}"]`)

async function cardShown(gameId: string) {
  await vi.waitFor(() => expect(card(gameId)).not.toBeNull(), { timeout: 10_000 })
  return card(gameId)!
}

/** The camera as GlobeMap last reported it, once it reports one that passes the check. */
async function cameraSettles(
  onCameraMove: ReturnType<typeof vi.fn<(camera: Camera) => void>>,
  check: (camera: Camera) => boolean,
  timeout = 15_000,
) {
  await vi.waitFor(() => expect(onCameraMove.mock.calls.some(([camera]) => check(camera))).toBe(true), { timeout })
}

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

describe('selection', () => {
  it('rings the selected game’s small pin and turns the globe to it', async () => {
    const { globe, map, onCameraMove } = openGlobe({ longitude: 0, latitude: 0, zoom: 2 })
    const a = game('A', { longitude: 20 })
    const b = game('B', { longitude: -20, latitude: 20 })
    globe.show([a, b])
    await pinsDrawn(map, smallPinLayer, a, b)

    globe.select('A')

    await cameraSettles(onCameraMove, (camera) => Math.abs(camera.longitude - 20) < 0.1)
    await vi.waitFor(() => expect(drawnAt(map, selectedPinLayer, a).map((f) => f.properties.gameId)).toEqual(['A']))
    expect(drawnAt(map, selectedPinLayer, b)).toEqual([])

    globe.select(null)
    await vi.waitFor(() => expect(drawnAt(map, selectedPinLayer, a)).toEqual([]))
  })

  it('highlights the selected game’s score card, zoomed in', async () => {
    const { globe } = openGlobe({ longitude: 0, latitude: 0, zoom: cardZoom + 1 })
    globe.show([game('A'), game('B', { longitude: 2 })])
    const a = await cardShown('A')

    globe.select('A')
    expect(a.classList).toContain('score-card--selected')
    expect(card('B')!.classList).not.toContain('score-card--selected')

    globe.select(null)
    expect(container.querySelector('.score-card--selected')).toBeNull()
  })

  it('does not turn to the selected game again when it is selected again', async () => {
    const { globe, map, onCameraMove } = openGlobe({ longitude: 0, latitude: 0, zoom: 2 })
    const a = game('A', { longitude: 20 })
    globe.show([a])
    await pinsDrawn(map, smallPinLayer, a)
    globe.select('A')
    await cameraSettles(onCameraMove, (camera) => Math.abs(camera.longitude - 20) < 0.1)
    map.jumpTo({ center: [0, 0] })

    globe.select('A')
    await pause(500)

    expect(map.getCenter().lng).toBeCloseTo(0)
  })

  it('tells the app when the viewer selects a small pin', async () => {
    const { globe, map, onSelect } = openGlobe({ longitude: 0, latitude: 0, zoom: 2 })
    const a = game('A')
    globe.show([a])
    await pinsDrawn(map, smallPinLayer, a)

    await userEvent.click(map.getCanvas(), { position: { x: 400, y: 300 } })

    expect(onSelect).toHaveBeenCalledWith('A')
  })
})

describe('zooming in to clusters and crowds', () => {
  it('zooms in to a cluster the viewer selects, no further than score cards', async () => {
    const { globe, map, onCameraMove } = openGlobe({ longitude: 0, latitude: 0, zoom: 2 })
    // At the same venue, so the cluster would only split at the cluster source's last zoom.
    globe.show([game('A'), game('B')])
    await pinsDrawn(map, clusterLayer, game('A'))

    await userEvent.click(map.getCanvas(), { position: { x: 400, y: 300 } })

    await cameraSettles(onCameraMove, (camera) => camera.zoom === cardZoom)
    await cardShown('A')
    await cardShown('B')
  })

  it('zooms in to a crowd the viewer selects until its games all have cards', async () => {
    const { globe, onCameraMove } = openGlobe({ longitude: 0, latitude: 0, zoom: cardZoom })
    // A grid of games a tenth of a degree apart: far too close for their cards to fit at cardZoom.
    const games = Array.from({ length: 16 }, (_, i) =>
      game(`G${i}`, { longitude: (i % 4) * 0.1, latitude: Math.floor(i / 4) * 0.1 }),
    )
    globe.show(games)
    await vi.waitFor(() => expect(container.querySelector('.score-crowd')).not.toBeNull(), { timeout: 10_000 })

    await userEvent.click(container.querySelector('.score-crowd')!)

    await cameraSettles(onCameraMove, (camera) => camera.zoom > cardZoom + 1)
    await vi.waitFor(() => expect(container.querySelector('.score-crowd')).toBeNull(), { timeout: 20_000 })
  })

  // Five or so zooms one after another: about 10 seconds in CI.
  it('zooms in again while some of a crowd’s games are still crowded, as far as the globe goes', { timeout: 30_000 }, async () => {
    const { globe, onCameraMove } = openGlobe({ longitude: 0, latitude: 0, zoom: cardZoom })
    // Two games half a degree out set how far the first zoom goes; at the venue between them,
    // more games than there's ever room for stay crowded after it.
    const sameVenue = Array.from({ length: 40 }, (_, i) => game(`V${i}`))
    globe.show([game('NE', { longitude: 0.5, latitude: 0.5 }), game('SW', { longitude: -0.5, latitude: -0.5 }), ...sameVenue])
    await vi.waitFor(() => expect(container.querySelector('.score-crowd')).not.toBeNull(), { timeout: 10_000 })

    await userEvent.click(container.querySelector('.score-crowd')!)

    await cameraSettles(onCameraMove, (camera) => camera.zoom === maxZoom, 25_000)
    const zooms = onCameraMove.mock.calls.map(([camera]) => camera.zoom)
    expect(zooms.filter((zoom) => zoom > cardZoom && zoom < maxZoom)).not.toEqual([])
  })
})

describe('score cards', () => {
  it('shows each change to a game straight away, however often games change', async () => {
    const { globe } = openGlobe({ longitude: 0, latitude: 0, zoom: cardZoom + 1 })
    globe.show([game('A', { clock: '15:00' })])
    await cardShown('A')

    // Every change reloads the pin source; changes coming faster than it loads mustn't hold cards back.
    for (let second = 59; second >= 40; second--) {
      const clock = `14:${second}`
      globe.show([game('A', { clock })])
      expect(card('A')!.textContent).toContain(clock)
      await pause(20)
    }
  })

  // Looking at 0°, 0° at cardZoom, the horizon is about 65° away: a game 100° east is behind the
  // globe, yet on screen, about where one 37° east is.
  it('shows no card for a game on the far side of the globe', async () => {
    const { globe } = openGlobe({ longitude: 0, latitude: 0, zoom: cardZoom })
    globe.show([game('NEAR'), game('FAR', { longitude: 100 })])
    await cardShown('NEAR')
    await pause(500)

    expect(card('FAR')).toBeNull()
  })

  it('does not move a card aside for a game on the far side', async () => {
    const { globe, map } = openGlobe({ longitude: 0, latitude: 0, zoom: cardZoom })
    const near = game('NEAR', { longitude: 37 })
    const far = game('FAR', { longitude: 100 })
    globe.show([near, far])
    const nearCard = await cardShown('NEAR')
    await pause(500)
    // The test only means something while the far game would sit under the near one's card.
    const [a, b] = [near, far].map(({ venue }) => map.project([venue.longitude, venue.latitude]))
    expect(Math.abs(a.x - b.x)).toBeLessThan(20)

    expect(nearCard.parentElement!.hasAttribute('data-moved')).toBe(false)
    expect(container.querySelector('.score-crowd')).toBeNull()
    const trails = [...container.querySelectorAll<SVGGElement>('.score-card-trails g')]
    expect(trails.filter((trail) => trail.style.display !== 'none')).toEqual([])
  })
})

describe('animations', () => {
  it.each([
    ['score', game('A', { home: 0 }), game('A', { home: 7 })],
    ['start', game('A', { status: 'Upcoming', home: null, away: null }), game('A', { home: 0 })],
    ['finish', game('A', { home: 21 }), game('A', { status: 'Final', home: 21 })],
  ] as const)('plays %s on a game’s score card', async (animation, before, after) => {
    const { globe } = openGlobe({ longitude: 0, latitude: 0, zoom: cardZoom + 1 })
    globe.show([before])
    await cardShown('A')

    globe.show([after])

    await vi.waitFor(() => expect(card('A')!.classList).toContain(`score-card--animate-${animation}`))
  })

  it('plays over a game’s small pin, zoomed out', async () => {
    const { globe, map } = openGlobe({ longitude: 0, latitude: 0, zoom: 2 })
    globe.show([game('A', { home: 0 })])
    await pinsDrawn(map, smallPinLayer, game('A'))

    globe.show([game('A', { home: 7 })])

    await vi.waitFor(() => expect(container.querySelector('.pin-pulse--pin.pin-pulse--score')).not.toBeNull())
  })

  it('plays over the cluster a game is in', async () => {
    const { globe, map } = openGlobe({ longitude: 0, latitude: 0, zoom: 2 })
    globe.show([game('A', { home: 0 }), game('B')])
    await pinsDrawn(map, clusterLayer, game('A'))

    globe.show([game('A', { home: 7 }), game('B')])

    await vi.waitFor(() => expect(container.querySelector('.pin-pulse--cluster.pin-pulse--score')).not.toBeNull())
  })

  it('does not animate a change the globe did not show, while the game was hidden', async () => {
    const { globe, map } = openGlobe({ longitude: 0, latitude: 0, zoom: 2 })
    const other = game('B', { longitude: 40 })
    globe.show([game('A', { home: 0 }), other])
    await pinsDrawn(map, smallPinLayer, game('A'), other)
    // Every pulse that starts, kept even after it has played and removed itself.
    const pulses: Element[] = []
    const watching = new MutationObserver(() => pulses.push(...container.querySelectorAll('.pin-pulse')))
    watching.observe(container, { childList: true, subtree: true })

    // Hidden by the viewer's settings, then shown again with a new score. Straight after, so the map
    // still has its pin and could animate it: only what the globe last showed rules it out.
    globe.show([other])
    globe.show([game('A', { home: 7 }), other])
    await pinsDrawn(map, smallPinLayer, game('A'))
    await pause(500)
    watching.disconnect()

    expect(pulses).toEqual([])
  })

  it('does not animate a change that only redraws the game', async () => {
    const { globe } = openGlobe({ longitude: 0, latitude: 0, zoom: cardZoom + 1 })
    globe.show([game('A', { clock: '12:00' })])
    await cardShown('A')

    globe.show([game('A', { clock: '11:42' })])
    await vi.waitFor(() => expect(card('A')!.textContent).toContain('11:42'))
    await pause(300)

    expect(card('A')!.className).not.toContain('score-card--animate')
  })
})

describe('destroy', () => {
  it('saves the camera when the page closes, until it is destroyed', async () => {
    const { globe, onCameraMove } = openGlobe({ longitude: 12, latitude: 34, zoom: 2.5 })
    window.dispatchEvent(new Event('pagehide'))
    expect(onCameraMove).toHaveBeenLastCalledWith({ longitude: 12, latitude: 34, zoom: 2.5 })

    globe.destroy()
    opened.splice(0)
    onCameraMove.mockClear()
    window.dispatchEvent(new Event('pagehide'))

    expect(onCameraMove).not.toHaveBeenCalled()
  })

  it('removes everything it added to the page and the window', async () => {
    const added = vi.spyOn(window, 'addEventListener')
    const removed = vi.spyOn(window, 'removeEventListener')
    const { globe } = openGlobe({ longitude: 0, latitude: 0, zoom: cardZoom + 1 })
    globe.show([game('A')])
    await cardShown('A')

    globe.destroy()
    opened.splice(0)

    const listeners = (spy: typeof added) => spy.mock.calls.map(([type, listener]) => ({ type, listener }))
    expect(listeners(added).length).toBeGreaterThan(0)
    expect(listeners(removed)).toEqual(expect.arrayContaining(listeners(added)))
    expect(container.querySelector('canvas, .globe-glow, .score-card, .score-card-trails')).toBeNull()
    added.mockRestore()
    removed.mockRestore()
  })
})
