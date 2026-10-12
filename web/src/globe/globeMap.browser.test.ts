import type { GeoJSONSource, Map as MapLibreMap, StyleSpecification } from 'maplibre-gl'
import type { Feature, FeatureCollection, LineString, Point } from 'geojson'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { userEvent } from 'vitest/browser'
import '../index.css'
import type { Game, GameStatus } from '../games/game'
import { applyTheme } from '../theme/applyTheme'
import { builtInTheme } from '../theme/builtInTheme'
import type { Camera } from './camera'
import { cardClusterLayer, cardLayoutSource } from './cardLayoutLayers'
import { GlobeMap } from './globeMap'
import { panelGap, smallPinReach } from './panelClearance'
import { isBehindGlobe } from './horizon'
import { pinClusterLayer, selectedPinLayer, smallPinLayer } from './pinLayers'
import { cardZoom, maxZoom } from './zoomLevels'

applyTheme(document.documentElement, builtInTheme)

/**
 * A plain style with nothing to fetch: no tiles, no place names, and no glyphs, so the counts of pin
 * clusters and card clusters aren't drawn (the tests look for the clusters themselves). The
 * place-name test adds a stand-in.
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
    sport: 'Football',
    startTime: '2026-10-04T17:00:00+00:00',
    status,
    delayed: false,
    disruption: null,
    endTime: null,
    home: { abbreviation: 'KC', fullName: 'Kansas City Chiefs', logoUrl: null, score: home },
    away: { abbreviation: 'BUF', fullName: 'Buffalo Bills', logoUrl: null, score: away },
    clock,
    period: null,
    clutchTime: false,
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

/** Opens a globe on the page, 800 × 600 unless given a size, looking at the given place. */
function openGlobe(startCamera: Camera, { width = 800, height = 600 } = {}) {
  container = document.createElement('div')
  container.style.cssText = `position: relative; width: ${width}px; height: ${height}px`
  document.body.append(container)
  const onSelect = vi.fn<(gameId: string) => void>()
  const onCameraMove = vi.fn<(camera: Camera) => void>()
  const globe = new GlobeMap(container, { style: plainStyle, theme: builtInTheme, startCamera, onSelect, onCameraMove })
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

/** Waits until the map has drawn these games' small pins, or the pin clusters they're in. */
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

/**
 * What the map has been given to draw of the score cards' layout (see cardLayoutLayers): its trails,
 * their venues, card clusters or footprints.
 */
async function laidOut(map: MapLibreMap, kind: 'trail' | 'venue' | 'cardCluster' | 'footprint') {
  const source = map.getSource<GeoJSONSource>(cardLayoutSource)
  if (!source) return []
  const { features } = (await source.getData()) as FeatureCollection
  return features.filter((feature) => feature.properties?.kind === kind)
}

/** Where on the map a card cluster is drawn, once there is one. */
async function cardClusterDrawn(map: MapLibreMap) {
  let at = { x: 0, y: 0 }
  await vi.waitFor(
    async () => {
      const [cardCluster] = (await laidOut(map, 'cardCluster')) as Feature<Point>[]
      expect(cardCluster).toBeDefined()
      const { x, y } = map.project(cardCluster.geometry.coordinates as [number, number])
      const drawn = map.queryRenderedFeatures(
        [
          [x - 10, y - 10],
          [x + 10, y + 10],
        ],
        { layers: [cardClusterLayer] },
      )
      expect(drawn).not.toEqual([])
      at = { x, y }
    },
    { timeout: 10_000 },
  )
  return at
}

// Small enough that a few dozen games' cards can't all find room.
const smallGlobe = { width: 400, height: 300 }

/** Where a game's venue is on the page. */
function venueOnPage(map: MapLibreMap, { venue }: Game) {
  const { x, y } = map.project([venue.longitude, venue.latitude])
  const { left, top } = container.getBoundingClientRect()
  return { x: left + x, y: top + y }
}

/** A game panel's box on the page, as the app's sits across the bottom of the globe. */
function panelAcrossBottom() {
  const { left, top, width, height } = container.getBoundingClientRect()
  return { left: left + 100, top: top + height - 140, right: left + width - 100, bottom: top + height - 12 }
}

/** How many pixels apart two positions on screen are. */
const offBy = (a: number, b: number) => Math.abs(a - b)

/** A computed CSS colour's red, green, blue (0 to 255) and alpha (0 to 1), as rgb(…) or color(srgb …). */
function channels(colour: string): [number, number, number, number] {
  const srgb = /^color\(srgb ([\d.e-]+) ([\d.e-]+) ([\d.e-]+)(?: \/ ([\d.]+))?\)$/.exec(colour)
  if (srgb) return [Number(srgb[1]) * 255, Number(srgb[2]) * 255, Number(srgb[3]) * 255, Number(srgb[4] ?? 1)]
  const rgb = /^rgba?\((\d+), (\d+), (\d+)(?:, ([\d.]+))?\)$/.exec(colour)
  if (rgb) return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3]), Number(rgb[4] ?? 1)]
  throw new Error(`Not a computed colour: ${colour}`)
}

const hexChannels = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))

/** Whether a colour lies between two others, strictly, in each channel that differs (to within rounding). */
function between(colour: string, from: string, to: string): boolean {
  const [a, b, c] = [channels(colour), hexChannels(from), hexChannels(to)]
  const channelsBetween = [0, 1, 2].every((i) =>
    b[i] === c[i] ? Math.abs(a[i] - b[i]) < 1 : a[i] > Math.min(b[i], c[i]) + 0.5 && a[i] < Math.max(b[i], c[i]) - 0.5,
  )
  return channelsBetween && [0, 1, 2].some((i) => b[i] !== c[i])
}

describe('score cards', () => {
  it('keeps every card solid, fading a Final or Disrupted game’s by colour into its fill', async () => {
    const { globe } = openGlobe({ longitude: 0, latitude: 0, zoom: cardZoom + 1 })
    // Far enough apart that none is moved aside.
    globe.show([game('L'), game('F', { longitude: 6, status: 'Final' }), game('D', { longitude: -6, status: 'Disrupted' })])
    const [live, final, disrupted] = await Promise.all(['L', 'F', 'D'].map(cardShown))
    const { card: look, status } = builtInTheme

    for (const shown of [live, final, disrupted]) {
      expect(getComputedStyle(shown).opacity, shown.dataset.gameId).toBe('1')
      expect(channels(getComputedStyle(shown).backgroundColor)[3], shown.dataset.gameId).toBe(1)
    }
    expect(channels(getComputedStyle(live).color).slice(0, 3).map(Math.round)).toEqual(hexChannels(look.text))
    expect(between(getComputedStyle(final).color, look.text, look.fill)).toBe(true)
    expect(between(getComputedStyle(final).borderTopColor, status.final.color, look.fill)).toBe(true)
    expect(between(getComputedStyle(disrupted).color, look.disrupted.text, look.disrupted.fill)).toBe(true)
  })
})

describe('selection', () => {
  it('rings the selected game’s small pin and leaves the globe where it is', async () => {
    const { globe, map } = openGlobe({ longitude: 0, latitude: 0, zoom: 2 })
    const a = game('A', { longitude: 20 })
    const b = game('B', { longitude: -20, latitude: 20 })
    globe.show([a, b])
    await pinsDrawn(map, smallPinLayer, a, b)

    globe.select('A', panelAcrossBottom())

    await vi.waitFor(() => expect(drawnAt(map, selectedPinLayer, a).map((f) => f.properties.gameId)).toEqual(['A']))
    expect(drawnAt(map, selectedPinLayer, b)).toEqual([])
    await pause(500)
    expect(map.getCenter().lng).toBeCloseTo(0)
    expect(map.getCenter().lat).toBeCloseTo(0)

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

  it('leaves a score card moved aside for its neighbours where it is when it is selected', async () => {
    const { globe } = openGlobe({ longitude: 0, latitude: 0, zoom: cardZoom + 1 })
    // Close enough that some cards are moved aside, not so close that any is in a card cluster.
    globe.show(Array.from({ length: 4 }, (_, i) => game(`G${i}`, { longitude: i * 0.4, status: i === 0 ? 'Live' : 'Final' })))
    await vi.waitFor(() => expect(container.querySelector('[data-moved] .score-card')).not.toBeNull(), { timeout: 10_000 })
    const moved = container.querySelector<HTMLElement>('[data-moved] .score-card')!
    const before = JSON.stringify(moved.getBoundingClientRect())
    const placed = () => [...container.querySelectorAll('.score-card')].map((c) => JSON.stringify(c.getBoundingClientRect()))
    const everyCard = placed()

    globe.select(moved.dataset.gameId!)
    await pause(500)

    expect(JSON.stringify(moved.getBoundingClientRect())).toBe(before)
    expect(placed()).toEqual(everyCard)
  })

  it('lifts a small pin the panel would cover just clear of it, without turning sideways', async () => {
    const { globe, map } = openGlobe({ longitude: 0, latitude: 0, zoom: 2 })
    const a = game('A', { longitude: 5, latitude: -40 })
    globe.show([a])
    await pinsDrawn(map, smallPinLayer, a)
    const panel = panelAcrossBottom()
    const before = venueOnPage(map, a)
    expect(before.y).toBeGreaterThan(panel.top)

    globe.select('A', panel)

    await vi.waitFor(() => expect(offBy(venueOnPage(map, a).y, panel.top - panelGap - smallPinReach)).toBeLessThan(2), {
      timeout: 5_000,
    })
    expect(offBy(venueOnPage(map, a).x, before.x)).toBeLessThan(2)
  })

  it('lifts a score card’s venue the panel would cover until the card and venue are clear of it', async () => {
    const { globe, map } = openGlobe({ longitude: 0, latitude: 0, zoom: cardZoom + 1 })
    const a = game('A', { latitude: -8 })
    globe.show([a])
    await cardShown('A')
    const panel = panelAcrossBottom()
    expect(venueOnPage(map, a).y).toBeGreaterThan(panel.top)

    globe.select('A', panel)

    await vi.waitFor(() => expect(offBy(venueOnPage(map, a).y, panel.top - panelGap)).toBeLessThan(2), { timeout: 5_000 })
    expect(card('A')!.getBoundingClientRect().bottom).toBeLessThan(panel.top)
  })

  it('does not lift the selected game again when it is selected again', async () => {
    const { globe, map } = openGlobe({ longitude: 0, latitude: 0, zoom: 2 })
    const a = game('A', { latitude: -40 })
    globe.show([a])
    await pinsDrawn(map, smallPinLayer, a)
    globe.select('A', panelAcrossBottom())
    await vi.waitFor(() => expect(map.getCenter().lat).toBeLessThan(-1), { timeout: 5_000 })
    await new Promise((resolve) => map.once('moveend', resolve))
    map.jumpTo({ center: [0, 0] })

    globe.select('A', panelAcrossBottom())
    await pause(500)

    expect(map.getCenter().lat).toBeCloseTo(0)
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

describe('zooming in to pin clusters and card clusters', () => {
  it('does not zoom in when the viewer double-clicks the globe', async () => {
    const { map } = openGlobe({ longitude: 0, latitude: 0, zoom: 2 })
    await new Promise((resolve) => map.once('load', resolve))

    await userEvent.dblClick(map.getCanvas(), { position: { x: 300, y: 200 } })
    await pause(500)

    expect(map.getZoom()).toBe(2)
  })

  it('zooms in to a pin cluster the viewer selects, no further than score cards', async () => {
    const { globe, map, onCameraMove } = openGlobe({ longitude: 0, latitude: 0, zoom: 2 })
    // At the same venue, so the pin cluster would only split at the pin source's last zoom.
    globe.show([game('A'), game('B')])
    await pinsDrawn(map, pinClusterLayer, game('A'))

    await userEvent.click(map.getCanvas(), { position: { x: 400, y: 300 } })

    await cameraSettles(onCameraMove, (camera) => camera.zoom === cardZoom)
    await cardShown('A')
    await cardShown('B')
  })

  it('zooms in to a card cluster the viewer selects until its games all have cards', async () => {
    const { globe, map, onCameraMove } = openGlobe({ longitude: 0, latitude: 0, zoom: cardZoom }, smallGlobe)
    // A grid of games a tenth of a degree apart: far too close for their cards to fit at cardZoom.
    const games = Array.from({ length: 16 }, (_, i) =>
      game(`G${i}`, { longitude: (i % 4) * 0.1, latitude: Math.floor(i / 4) * 0.1 }),
    )
    globe.show(games)
    const cardCluster = await cardClusterDrawn(map)

    await userEvent.click(map.getCanvas(), { position: cardCluster })

    await cameraSettles(onCameraMove, (camera) => camera.zoom > cardZoom + 1)
    await vi.waitFor(async () => expect(await laidOut(map, 'cardCluster')).toEqual([]), { timeout: 20_000 })
  })

  // Five or so zooms one after another: about 10 seconds in CI.
  it('zooms in again while some of a card cluster’s games are still in one, as far as the globe goes', { timeout: 30_000 }, async () => {
    const { globe, map, onCameraMove } = openGlobe({ longitude: 0, latitude: 0, zoom: cardZoom }, smallGlobe)
    // Two games half a degree out set how far the first zoom goes; at the venue between them,
    // more games than there's ever room for stay in a card cluster after it.
    const sameVenue = Array.from({ length: 40 }, (_, i) => game(`V${i}`))
    globe.show([game('NE', { longitude: 0.5, latitude: 0.5 }), game('SW', { longitude: -0.5, latitude: -0.5 }), ...sameVenue])
    const cardCluster = await cardClusterDrawn(map)

    await userEvent.click(map.getCanvas(), { position: cardCluster })

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
    expect(await laidOut(map, 'cardCluster')).toEqual([])
    expect(await laidOut(map, 'trail')).toEqual([])
  })

  it('has the map draw a trail from a moved card to its venue, and a ringed point on the venue', async () => {
    const { globe, map } = openGlobe({ longitude: 0, latitude: 0, zoom: cardZoom + 1 })
    const [a, b] = [game('A'), game('B')]
    globe.show([a, b])
    await vi.waitFor(() => expect(container.querySelector('[data-moved] .score-card')).not.toBeNull(), { timeout: 10_000 })

    await vi.waitFor(() => expect(drawnAt(map, 'trail-venues', a)).not.toEqual([]), { timeout: 10_000 })
    const [trail] = (await laidOut(map, 'trail')) as Feature<LineString>[]
    const [, venue] = trail.geometry.coordinates
    expect(venue).toEqual([0, 0])
  })
})

describe('settling', () => {
  /** Each score card on the page, by game, and where it is. */
  const cardsOnPage = () =>
    [...container.querySelectorAll<HTMLElement>('.score-card')]
      .map((element) => {
        const { x, y } = element.getBoundingClientRect()
        return `${element.dataset.gameId} at ${Math.round(x)}, ${Math.round(y)}`
      })
      .sort()

  // Close enough together that their cards have to move aside for each other, which takes frames.
  const crowd = ['A', 'B', 'C', 'D'].map((id, i) => game(id, { longitude: i * 0.3 }))

  it('settles once the games it was shown have their score cards, each where it stays', async () => {
    const { globe } = openGlobe({ longitude: 0, latitude: 0, zoom: cardZoom + 1 })
    globe.show(crowd)
    expect(globe.settled()).toBe(false)

    await vi.waitFor(() => expect(globe.settled()).toBe(true), { timeout: 10_000 })
    const settled = cardsOnPage()
    expect(settled).toHaveLength(crowd.length)
    await pause(500)
    expect(cardsOnPage()).toEqual(settled)
    expect(globe.settled()).toBe(true)
  })

  it('is unsettled by a change of games until the change has been shown and has settled', async () => {
    const { globe } = openGlobe({ longitude: 0, latitude: 0, zoom: cardZoom + 1 })
    globe.show(crowd.slice(0, 2))
    await vi.waitFor(() => expect(globe.settled()).toBe(true), { timeout: 10_000 })

    globe.show(crowd)
    expect(globe.settled()).toBe(false)

    await vi.waitFor(() => expect(globe.settled()).toBe(true), { timeout: 10_000 })
    expect(cardsOnPage()).toHaveLength(crowd.length)
  })
})

describe('place names', () => {
  // The test style has no glyphs, so a layer of plain squares stands in for the place names: MapLibre
  // places both the same way. Unlike the other tests, this one adds to the map itself, as GlobeMap
  // has no place names of its own to show here.
  it('stops writing a name the moment the globe turns it over the horizon', async () => {
    const { map } = openGlobe({ longitude: 0, latitude: 0, zoom: 2.5 })
    const standIn = 'place-name-stand-in'
    const place: [number, number] = [50, 0]
    await new Promise((resolve) => map.once('load', resolve))
    map.addImage(standIn, { width: 8, height: 8, data: new Uint8Array(8 * 8 * 4).fill(255) })
    map.addSource(standIn, { type: 'geojson', data: { type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: place } } })
    map.addLayer({ id: standIn, type: 'symbol', source: standIn, layout: { 'icon-image': standIn } })
    const written = () => map.queryRenderedFeatures({ layers: [standIn] })
    await vi.waitFor(() => expect(written()).toHaveLength(1))

    // Turned a step a frame, as a drag turns it: from just this side of the horizon, so it crosses
    // on the very next frame, well within a fade (the time names were left where they were placed).
    const turnTo = async (longitude: number) => {
      map.jumpTo({ center: [longitude, 0] })
      await new Promise((resolve) => map.once('render', resolve))
    }
    await turnTo(-20)
    expect(isBehindGlobe(map, place)).toBe(false)
    expect(written()).toHaveLength(1)
    for (const longitude of [-25, -30, -35, -40, -45]) {
      await turnTo(longitude)
      expect(isBehindGlobe(map, place), `turned to ${longitude}°`).toBe(true)
      expect(written(), `turned to ${longitude}°`).toEqual([])
    }
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

  it('plays over the pin cluster a game is in', async () => {
    const { globe, map } = openGlobe({ longitude: 0, latitude: 0, zoom: 2 })
    globe.show([game('A', { home: 0 }), game('B')])
    await pinsDrawn(map, pinClusterLayer, game('A'))

    globe.show([game('A', { home: 7 }), game('B')])

    await vi.waitFor(() => expect(container.querySelector('.pin-pulse--cluster.pin-pulse--score')).not.toBeNull())
  })

  // Looking at 0°, 0° zoomed out, a game 90° east is behind the globe, but still in the map's
  // loaded tiles, so it would be found to animate.
  it('does not play over a small pin on the far side of the globe', async () => {
    const { globe, map } = openGlobe({ longitude: 0, latitude: 0, zoom: 2 })
    const near = game('NEAR', { home: 0 })
    globe.show([near, game('FAR', { longitude: 90, home: 0 })])
    await pinsDrawn(map, smallPinLayer, near)
    const pulses: Element[] = []
    const watching = new MutationObserver(() => pulses.push(...container.querySelectorAll('.pin-pulse')))
    watching.observe(container, { childList: true, subtree: true })

    globe.show([near, game('FAR', { longitude: 90, home: 7 })])
    await pause(500)
    watching.disconnect()

    expect(pulses).toEqual([])
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
    expect(container.querySelector('canvas, .globe-glow, .score-card')).toBeNull()
    added.mockRestore()
    removed.mockRestore()
  })
})
