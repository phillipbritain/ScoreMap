import type { GeoJSONSource, Map as MapLibreMap, StyleSpecification } from 'maplibre-gl'
import type { Feature, FeatureCollection, LineString, Point } from 'geojson'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { userEvent } from 'vitest/browser'
import '../index.css'
import type { Game, GameStatus } from '../games/game'
import { applyTheme } from '../theme/applyTheme'
import { builtInTheme } from '../theme/builtInTheme'
import { themeWith } from '../theme/testTheme'
import type { Camera } from './camera'
import { cardJump } from './cardJump'
import { cardClusterLayer, cardLayoutSource } from './cardLayoutLayers'
import { GlobeMap, type LoadingStage } from './globeMap'
import { panelGap, smallPinReach } from './panelClearance'
import { isBehindGlobe } from './horizon'
import { outerPinClusterLayer, outerSmallPinLayer, pinClusterLayer, selectedPinLayer, smallPinLayer } from './pinLayers'
import { cardZoom, maxZoom } from './zoomLevels'

/**
 * When set, every layout of the score cards nudges each card (and its trail) that many pixels the
 * other way from the last, so the cards never steady. A fraction of a pixel leaves the layout the map
 * draws (to the pixel) the same; a whole pixel changes it every frame.
 */
const layout = vi.hoisted(() => ({ shift: 0 }))
vi.mock('./cardLayout', async (importOriginal) => {
  const original = await importOriginal<typeof import('./cardLayout')>()
  let sign = 1
  return {
    ...original,
    layOutCards: (...args: Parameters<typeof original.layOutCards>) => {
      const laidOut = original.layOutCards(...args)
      if (!layout.shift) return laidOut
      sign = -sign
      const nudge = sign * layout.shift
      for (const placement of laidOut.cards.values()) {
        placement.offset = { ...placement.offset, dx: placement.offset.dx + nudge }
        if (placement.trail) placement.trail = { ...placement.trail, x1: placement.trail.x1 + nudge }
      }
      return laidOut
    },
  }
})

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
  home?: string | null
  away?: string | null
  clock?: string | null
}

function game(id: string, { longitude = 0, latitude = 0, status = 'Live', home = '0', away = '0', clock = null }: GameAt = {}): Game {
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
    venue: { name: null, city: null, region: null, country: null, latitude, longitude, timeZone: null, photo: null },
    broadcasters: [],
    streamLinks: [],
  }
}

const opened: GlobeMap[] = []
let container: HTMLElement

afterEach(() => {
  layout.shift = 0
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
  const onStage = vi.fn<(stage: LoadingStage) => void>()
  const globe = new GlobeMap(container, { style: plainStyle, theme: builtInTheme, startCamera, onSelect, onCameraMove, onStage })
  opened.push(globe)
  // MapLibre's own map, to see what it draws; the tests drive the globe only through GlobeMap.
  const map = (globe as unknown as { map: MapLibreMap }).map
  return { globe, map, onSelect, onCameraMove, onStage }
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
  it('fades a Final or Disrupted game’s card by colour into its fill, not by opacity', async () => {
    const { globe } = openGlobe({ longitude: 0, latitude: 0, zoom: cardZoom + 1 })
    // Far enough apart that none is moved aside.
    globe.show([game('L'), game('F', { longitude: 6, status: 'Final' }), game('D', { longitude: -6, status: 'Disrupted' })])
    const [live, final, disrupted] = await Promise.all(['L', 'F', 'D'].map(cardShown))
    const { components: { ScoreCard: look }, palette } = builtInTheme

    // Every card's fill as opaque as the theme says, whatever its status.
    const fillOpacity = look.fillOpacity
    for (const shown of [live, final, disrupted]) {
      expect(getComputedStyle(shown).opacity, shown.dataset.gameId).toBe('1')
      expect(channels(getComputedStyle(shown).backgroundColor)[3], shown.dataset.gameId).toBeCloseTo(fillOpacity, 2)
    }
    expect(channels(getComputedStyle(live).color).slice(0, 3).map(Math.round)).toEqual(hexChannels(look.text))
    expect(between(getComputedStyle(final).color, look.text, look.fill)).toBe(true)
    expect(between(getComputedStyle(final).borderTopColor, palette.final.main, look.fill)).toBe(true)
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
    // Only the near card's own trail, down to its venue.
    expect(await laidOut(map, 'trail')).toHaveLength(1)
  })

  it('has the map draw a trail from a card to its venue, and a ringed point on the venue', async () => {
    const { globe, map } = openGlobe({ longitude: 0, latitude: 0, zoom: cardZoom + 1 })
    const a = game('A')
    globe.show([a])

    await vi.waitFor(() => expect(drawnAt(map, 'trail-venues', a)).not.toEqual([]), { timeout: 10_000 })
    const [trail] = (await laidOut(map, 'trail')) as Feature<LineString>[]
    const [, venue] = trail.geometry.coordinates
    expect(venue).toEqual([0, 0])
  })

  it('has the trails of cards at one venue meet at a venue cluster there', async () => {
    const { globe, map } = openGlobe({ longitude: 0, latitude: 0, zoom: cardZoom + 1 })
    const [a, b] = [game('A'), game('B')]
    globe.show([a, b])

    await vi.waitFor(() => expect(drawnAt(map, 'venue-clusters', a)).not.toEqual([]), { timeout: 10_000 })
    expect(drawnAt(map, 'trail-venues', a)).toEqual([])
  })
})

// Big enough to show the whole globe at cardZoom, about 440 pixels from its centre to its rim, so
// games past the card radius are on screen.
const wideGlobe = { width: 1000, height: 740 }

describe('score cards near the centre of the view', () => {
  // About 44° from 0°, 0°: past the card radius, on screen in a wide globe.
  const outerVenue = { longitude: 38, latitude: 25 }

  /** Whether a game's venue is on the globe's canvas, so what's drawn there can be found. */
  function onCanvas(map: MapLibreMap, { venue }: Game) {
    const { x, y } = map.project([venue.longitude, venue.latitude])
    return x > 0 && x < wideGlobe.width && y > 0 && y < wideGlobe.height
  }

  it('shows a game near the centre as a score card, and one farther out as a small pin', async () => {
    const { globe, map } = openGlobe({ longitude: 0, latitude: 0, zoom: cardZoom }, wideGlobe)
    const outer = game('OUTER', outerVenue)
    globe.show([game('INNER', { longitude: 20 }), outer])
    await cardShown('INNER')
    expect(onCanvas(map, outer)).toBe(true)

    await pinsDrawn(map, outerSmallPinLayer, outer)
    expect(card('OUTER')).toBeNull()
  })

  it('clusters the pins farther out among themselves, leaving the games near the centre their cards', async () => {
    const { globe, map } = openGlobe({ longitude: 0, latitude: 0, zoom: cardZoom }, wideGlobe)
    // Just inside the card radius, a few degrees from the outer games.
    const inner = game('INNER', { longitude: 34, latitude: 22 })
    const outer = [game('OUTER1', outerVenue), game('OUTER2', outerVenue)]
    globe.show([inner, ...outer])
    await cardShown('INNER')

    await pinsDrawn(map, outerPinClusterLayer, outer[0])
    expect(drawnAt(map, outerPinClusterLayer, outer[0]).map((f) => f.properties.point_count)).toContain(2)
    expect(card('OUTER1')).toBeNull()
    expect(card('OUTER2')).toBeNull()
  })

  it('gives a game a card once the globe turns its venue within the card radius', async () => {
    const { globe, map } = openGlobe({ longitude: 0, latitude: 0, zoom: cardZoom }, wideGlobe)
    globe.show([game('OUTER', outerVenue)])
    await pinsDrawn(map, outerSmallPinLayer, game('OUTER', outerVenue))

    // At the zoom it was: MapLibre's globe would zoom out a little, turning north from the equator.
    map.jumpTo({ center: [30, 20], zoom: cardZoom })

    await cardShown('OUTER')
    await vi.waitFor(() => expect(drawnAt(map, outerSmallPinLayer, game('OUTER', outerVenue))).toEqual([]))
  })

  it('tells the app when the viewer selects a pin farther out, and leaves the globe where it is', async () => {
    const { globe, map, onSelect } = openGlobe({ longitude: 0, latitude: 0, zoom: cardZoom }, wideGlobe)
    const outer = game('OUTER', outerVenue)
    globe.show([outer])
    await pinsDrawn(map, outerSmallPinLayer, outer)

    await userEvent.click(map.getCanvas(), { position: map.project([outerVenue.longitude, outerVenue.latitude]) })
    await pause(500)

    expect(onSelect).toHaveBeenCalledWith('OUTER')
    expect(map.getCenter().lng).toBeCloseTo(0)
    expect(map.getCenter().lat).toBeCloseTo(0)
  })

  it('centres the globe on a pin cluster farther out the viewer selects, at the same zoom, so its games have cards', async () => {
    // Past cardZoom, where selecting a pin cluster zoomed out would zoom out to it.
    const zoom = cardZoom + 0.2
    const { globe, map, onCameraMove } = openGlobe({ longitude: 0, latitude: 0, zoom }, wideGlobe)
    const venue = outerVenue
    globe.show([game('A', venue), game('B', venue)])
    await pinsDrawn(map, outerPinClusterLayer, game('A', venue))
    expect(onCanvas(map, game('A', venue))).toBe(true)

    await userEvent.click(map.getCanvas(), { position: map.project([venue.longitude, venue.latitude]) })

    await cameraSettles(
      onCameraMove,
      (camera) =>
        camera.zoom === zoom && offBy(camera.longitude, venue.longitude) < 0.5 && offBy(camera.latitude, venue.latitude) < 0.5,
    )
    await cardShown('A')
    await cardShown('B')
  })
})

describe('loading stage', () => {
  it('is waiting for games until it is given some, however long it has been open', async () => {
    const { globe, map } = openGlobe({ longitude: 0, latitude: 0, zoom: cardZoom + 1 })
    expect(globe.stage()).toBe('waitingForGames')

    await new Promise((resolve) => map.once('idle', resolve))
    globe.show(null)
    await pause(300)
    expect(globe.stage()).toBe('waitingForGames')
  })

  it('is drawing the games it is given until it settles, then ready', async () => {
    const { globe, map } = openGlobe({ longitude: 0, latitude: 0, zoom: cardZoom + 1 })
    const crowd = ['A', 'B', 'C', 'D'].map((id, i) => game(id, { longitude: i * 0.3 }))
    globe.show(crowd)
    expect(globe.stage()).toBe('drawing')

    // The stage in each frame, beside whether the globe had settled by then.
    const frames: string[] = []
    const record = () => frames.push(`${globe.settled() ? 'settled' : 'unsettled'}, ${globe.stage()}`)
    map.on('render', record)
    await vi.waitFor(() => expect(globe.stage()).toBe('ready'), { timeout: 10_000 })
    map.off('render', record)

    expect(frames).toContain('unsettled, drawing')
    expect(frames).not.toContain('unsettled, ready')
    expect(frames).not.toContain('settled, drawing')
    expect(globe.settled()).toBe(true)
    expect(container.querySelectorAll('.score-card')).toHaveLength(crowd.length)
  })

  it('tells its owner each time its stage moves on, without being asked', async () => {
    const { globe, map, onStage } = openGlobe({ longitude: 0, latitude: 0, zoom: cardZoom + 1 })
    await new Promise((resolve) => map.once('idle', resolve))
    globe.show(null)
    expect(onStage).not.toHaveBeenCalled()

    globe.show([game('A'), game('B', { longitude: 0.3 })])
    expect(onStage.mock.calls).toEqual([['drawing']])
    await vi.waitFor(() => expect(onStage).toHaveBeenLastCalledWith('ready'), { timeout: 10_000 })

    map.easeTo({ center: [10, 5], duration: 300 })
    globe.show([game('A', { home: '7' })])
    globe.show(null)
    globe.show([game('A')])
    await vi.waitFor(() => expect(globe.settled()).toBe(true), { timeout: 10_000 })
    expect(onStage.mock.calls).toEqual([['drawing'], ['ready']])
  })

  it('becomes ready given no games at all', async () => {
    const { globe } = openGlobe({ longitude: 0, latitude: 0, zoom: 2 })
    globe.show([])
    expect(globe.stage()).toBe('drawing')

    await vi.waitFor(() => expect(globe.stage()).toBe('ready'), { timeout: 10_000 })
  })

  it('becomes ready once its score cards stop trying to settle, though their layout never steadies', async () => {
    layout.shift = 0.25
    const { globe } = openGlobe({ longitude: 0, latitude: 0, zoom: cardZoom + 1 })
    globe.show([game('A'), game('B', { longitude: 0.3 })])

    await vi.waitFor(() => expect(globe.stage()).toBe('ready'), { timeout: 10_000 })
    expect(container.querySelectorAll('.score-card')).toHaveLength(2)
    expect(globe.cardsSteady()).toBe(false)
    expect(globe.settled()).toBe(false)
  })

  it('becomes ready and stops drawing once its score cards stop trying to settle, though they jump a pixel every frame', async () => {
    layout.shift = 1
    const { globe, map } = openGlobe({ longitude: 0, latitude: 0, zoom: cardZoom + 1 })
    globe.show([game('A'), game('B', { longitude: 0.3 })])

    await vi.waitFor(() => expect(globe.stage()).toBe('ready'), { timeout: 10_000 })
    expect(container.querySelectorAll('.score-card')).toHaveLength(2)
    expect(globe.settled()).toBe(false)
    const drawn = vi.fn()
    map.on('render', drawn)
    await pause(500)
    expect(drawn).not.toHaveBeenCalled()
  })

  it('keeps every trail on its card through a long pan after its score cards give up settling', async () => {
    layout.shift = 1
    const { globe, map } = openGlobe({ longitude: 0, latitude: 0, zoom: cardZoom + 1 })
    // Close enough together that their cards have to move aside for each other, with trails.
    globe.show(['A', 'B', 'C', 'D'].map((id, i) => game(id, { longitude: i * 0.3 })))
    await vi.waitFor(() => expect(globe.stage()).toBe('ready'), { timeout: 10_000 })

    // How far each trail's end at its card is from the nearest moved card's edge, in pixels.
    const trailsOffCards = async () => {
      const page = map.getContainer().getBoundingClientRect()
      const cards = [...container.querySelectorAll<HTMLElement>(':not([data-in-card-cluster]) > .score-card')].map((element) =>
        element.getBoundingClientRect(),
      )
      const trails = (await laidOut(map, 'trail')) as Feature<LineString>[]
      expect(trails).not.toEqual([])
      return trails.map(({ geometry }) => {
        const { x, y } = map.project(geometry.coordinates[0] as [number, number])
        const [px, py] = [page.x + x, page.y + y]
        return Math.min(
          ...cards.map(({ left, right, top, bottom }) => {
            const outside = Math.hypot(Math.max(left - px, 0, px - right), Math.max(top - py, 0, py - bottom))
            return outside > 0 ? outside : Math.min(px - left, right - px, py - top, bottom - py)
          }),
        )
      })
    }
    for (const off of await trailsOffCards()) expect(off).toBeLessThan(1)

    // Whether the map has gone idle since the camera last moved.
    let idleSinceMoving = false
    map.on('move', () => (idleSinceMoving = false))
    map.on('idle', () => (idleSinceMoving = true))
    // Over a pole on the glow's edge, as the glow test's is.
    map.easeTo({ center: [12, 8], duration: 2000 })
    await vi.waitFor(() => expect(!map.isMoving() && idleSinceMoving).toBe(true), { timeout: 10_000 })
    expect(globe.settled()).toBe(false)
    for (const off of await trailsOffCards()) expect(off).toBeLessThan(1)
  })

  it('takes no keyboard input until it is ready, then takes it', async () => {
    const { globe, map } = openGlobe({ longitude: 0, latitude: 0, zoom: 3 })
    await new Promise((resolve) => map.once('idle', resolve))
    map.getCanvas().focus()

    await userEvent.keyboard('{ArrowRight}+')
    await pause(500)
    expect(map.getCenter().lng).toBe(0)
    expect(map.getZoom()).toBe(3)

    globe.show([game('A')])
    await vi.waitFor(() => expect(globe.stage()).toBe('ready'), { timeout: 10_000 })
    map.getCanvas().focus()
    await userEvent.keyboard('+')
    await vi.waitFor(() => expect(map.getZoom()).toBeGreaterThan(3), { timeout: 5_000 })
  })

  it('stays ready through a pan, a change of games and a fresh snapshot', async () => {
    const { globe, map } = openGlobe({ longitude: 0, latitude: 0, zoom: cardZoom + 1 })
    globe.show([game('A'), game('B', { longitude: 0.3 })])
    await vi.waitFor(() => expect(globe.stage()).toBe('ready'), { timeout: 10_000 })

    // Its stage in every frame from here on.
    const stages = new Set<string>()
    const record = () => stages.add(globe.stage())
    map.on('render', record)

    map.easeTo({ center: [10, 5], duration: 300 })
    expect(globe.stage()).toBe('ready')
    await vi.waitFor(() => expect(globe.settled()).toBe(true), { timeout: 10_000 })

    globe.show([game('A', { home: '7' }), game('B', { longitude: 0.3 }), game('C', { longitude: 10, latitude: 5 })])
    expect(globe.settled()).toBe(false)
    expect(globe.stage()).toBe('ready')
    await vi.waitFor(() => expect(globe.settled()).toBe(true), { timeout: 10_000 })

    // A fresh snapshot, as after a reconnection: no games yet, then the games again.
    globe.show(null)
    globe.show([game('D', { longitude: 10, latitude: 5 })])
    expect(globe.stage()).toBe('ready')
    await vi.waitFor(() => expect(globe.settled()).toBe(true), { timeout: 10_000 })

    map.off('render', record)
    expect([...stages]).toEqual(['ready'])
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

    await vi.waitFor(() => expect(globe.stage()).toBe('ready'), { timeout: 10_000 })
    expect(globe.settled()).toBe(true)
    const settled = cardsOnPage()
    expect(settled).toHaveLength(crowd.length)
    await pause(500)
    expect(cardsOnPage()).toEqual(settled)
    expect(globe.settled()).toBe(true)
  })

  it('is unsettled by a change of games until the change has been shown and has settled', async () => {
    const { globe } = openGlobe({ longitude: 0, latitude: 0, zoom: cardZoom + 1 })
    globe.show(crowd.slice(0, 2))
    await vi.waitFor(() => expect(globe.stage()).toBe('ready'), { timeout: 10_000 })

    globe.show(crowd)
    expect(globe.settled()).toBe(false)

    await vi.waitFor(() => expect(globe.settled()).toBe(true), { timeout: 10_000 })
    expect(cardsOnPage()).toHaveLength(crowd.length)
  })

  it('keeps cards from jumping as they settle after the globe stops panning across a crowd', async () => {
    const { globe, map } = openGlobe({ longitude: 14, latitude: 0, zoom: cardZoom + 1 })
    // Fifty venues packed in a spiral, far too close for their cards to sit over them.
    const statuses: GameStatus[] = ['Live', 'Upcoming', 'Final']
    const games = new Map(
      Array.from({ length: 50 }, (_, i) => {
        const r = 0.15 * Math.sqrt(i)
        const angle = i * 2.39996
        const id = `G${String(i).padStart(2, '0')}`
        return [id, game(id, { longitude: r * Math.cos(angle), latitude: r * Math.sin(angle), status: statuses[i % 3] })]
      }),
    )
    globe.show([...games.values()])
    await vi.waitFor(() => expect(globe.stage()).toBe('ready'), { timeout: 10_000 })

    // Where each card is from its venue, by game, leaving out those in a card cluster.
    type Frame = Map<string, { dx: number; dy: number }>
    const cardsFromVenues = (): Frame =>
      new Map(
        [...container.querySelectorAll<HTMLElement>('.score-card')]
          .filter((element) => !element.parentElement!.hasAttribute('data-in-card-cluster'))
          .map((element) => {
            const gameId = element.dataset.gameId!
            const { x, y } = element.getBoundingClientRect()
            const venue = venueOnPage(map, games.get(gameId)!)
            return [gameId, { dx: x - venue.x, dy: y - venue.y }]
          }),
      )
    // The games whose cards jumped from one frame to the next: the same cap as cardLayout's "keeps
    // cards anchored as the globe pans across a crowd of venues".
    const jumped = (was: Frame, now: Frame) =>
      [...now].flatMap(([gameId, { dx, dy }]) => {
        const before = was.get(gameId)
        return before && Math.hypot(dx - before.dx, dy - before.dy) > cardJump ? [gameId] : []
      })

    // Panned a step a frame, as a drag pans it (about 6 px), bringing the crowd in from the left edge
    // to near the middle, and on until a frame changes the layout: so the cards are still settling as
    // it stops.
    let longitude = 14
    while (longitude > 3 || (globe.cardsSteady() && longitude > -3)) {
      longitude -= 0.25
      map.jumpTo({ center: [longitude, 0] })
      await new Promise((resolve) => map.once('render', resolve))
    }
    expect(globe.cardsSteady(), 'the pan stopped as the cards settled').toBe(false)
    // The cards in each frame from the camera stopping until they settle.
    const frames = [cardsFromVenues()]
    const record = () => frames.push(cardsFromVenues())
    map.on('render', record)
    await vi.waitFor(() => expect(globe.settled()).toBe(true), { timeout: 10_000 })
    map.off('render', record)

    const jumps = frames.slice(1).flatMap((now, i) => jumped(frames[i], now).map((gameId) => `${gameId} in frame ${i + 1}`))
    expect(jumps).toEqual([])

    const settled = cardsFromVenues()
    expect(settled.size).toBeGreaterThan(0)
    await pause(500)
    expect(cardsFromVenues()).toEqual(settled)
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
    ['score', game('A', { home: '0' }), game('A', { home: '7' })],
    ['start', game('A', { status: 'Upcoming', home: null, away: null }), game('A', { home: '0' })],
    ['finish', game('A', { home: '21' }), game('A', { status: 'Final', home: '21' })],
  ] as const)('plays %s on a game’s score card', async (animation, before, after) => {
    const { globe } = openGlobe({ longitude: 0, latitude: 0, zoom: cardZoom + 1 })
    globe.show([before])
    await cardShown('A')

    globe.show([after])

    await vi.waitFor(() => expect(card('A')!.classList).toContain(`score-card--animate-${animation}`))
  })

  it('plays over a game’s small pin, zoomed out', async () => {
    const { globe, map } = openGlobe({ longitude: 0, latitude: 0, zoom: 2 })
    globe.show([game('A', { home: '0' })])
    await pinsDrawn(map, smallPinLayer, game('A'))

    globe.show([game('A', { home: '7' })])

    await vi.waitFor(() => expect(container.querySelector('.pin-pulse--pin.pin-pulse--score')).not.toBeNull())
  })

  it('plays over the pin cluster a game is in', async () => {
    const { globe, map } = openGlobe({ longitude: 0, latitude: 0, zoom: 2 })
    globe.show([game('A', { home: '0' }), game('B')])
    await pinsDrawn(map, pinClusterLayer, game('A'))

    globe.show([game('A', { home: '7' }), game('B')])

    await vi.waitFor(() => expect(container.querySelector('.pin-pulse--cluster.pin-pulse--score')).not.toBeNull())
  })

  // Looking at 0°, 0° zoomed out, a game 90° east is behind the globe, but still in the map's
  // loaded tiles, so it would be found to animate.
  it('does not play over a small pin on the far side of the globe', async () => {
    const { globe, map } = openGlobe({ longitude: 0, latitude: 0, zoom: 2 })
    const near = game('NEAR', { home: '0' })
    globe.show([near, game('FAR', { longitude: 90, home: '0' })])
    await pinsDrawn(map, smallPinLayer, near)
    const pulses: Element[] = []
    const watching = new MutationObserver(() => pulses.push(...container.querySelectorAll('.pin-pulse')))
    watching.observe(container, { childList: true, subtree: true })

    globe.show([near, game('FAR', { longitude: 90, home: '7' })])
    await pause(500)
    watching.disconnect()

    expect(pulses).toEqual([])
  })

  it('does not animate a change the globe did not show, while the game was hidden', async () => {
    const { globe, map } = openGlobe({ longitude: 0, latitude: 0, zoom: 2 })
    const other = game('B', { longitude: 40 })
    globe.show([game('A', { home: '0' }), other])
    await pinsDrawn(map, smallPinLayer, game('A'), other)
    // Every pulse that starts, kept even after it has played and removed itself.
    const pulses: Element[] = []
    const watching = new MutationObserver(() => pulses.push(...container.querySelectorAll('.pin-pulse')))
    watching.observe(container, { childList: true, subtree: true })

    // Hidden by the viewer's settings, then shown again with a new score. Straight after, so the map
    // still has its pin and could animate it: only what the globe last showed rules it out.
    globe.show([other])
    globe.show([game('A', { home: '7' }), other])
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

describe('glow', () => {
  it('keeps drawing and lets the camera stop when the globe is eased to where a pole is a whole number of degrees away', async () => {
    const { map } = openGlobe({ longitude: 0, latitude: 0, zoom: 4 })
    await new Promise((resolve) => map.once('idle', resolve))
    const thrown: unknown[] = []
    const onError = (event: ErrorEvent) => {
      thrown.push(event.error)
      event.preventDefault()
    }
    window.addEventListener('error', onError)
    try {
      let stopped = false
      map.once('moveend', () => (stopped = true))
      // 82° north of 8°N is the North Pole.
      map.easeTo({ center: [12, 8], duration: 300 })
      await vi.waitFor(() => expect(stopped).toBe(true), { timeout: 5_000 })
    } finally {
      window.removeEventListener('error', onError)
    }

    expect(thrown).toEqual([])
    const glow = container.querySelector<HTMLElement>('.globe-glow')!
    expect(Number.isFinite(parseFloat(glow.style.width))).toBe(true)
  })
})

describe('changing theme', () => {
  /** A game this many pixels east of the centre of the view. */
  const gameEastBy = (map: MapLibreMap, id: string, pixels: number) => {
    const { width, height } = map.getContainer().getBoundingClientRect()
    const { lng, lat } = map.unproject([width / 2 + pixels, height / 2])
    return game(id, { longitude: lng, latitude: lat })
  }

  afterEach(() => applyTheme(document.documentElement, builtInTheme))

  it('restyles the games’ layers in place, without making the map again', async () => {
    const { globe, map } = openGlobe({ longitude: 0, latitude: 0, zoom: 2 })
    const a = game('A')
    globe.show([a])
    await pinsDrawn(map, smallPinLayer, a)
    let reloaded = false
    map.once('style.load', () => (reloaded = true))

    globe.setTheme(themeWith((json) => ((json.components.Trail.glow.width = 6), (json.components.Pin.live.core.color = '#ff0000'))))

    expect(map.getPaintProperty('trail-glows', 'line-width')).toBe(6)
    expect(JSON.stringify(map.getPaintProperty(smallPinLayer, 'circle-color'))).toContain('#ff0000')
    await vi.waitFor(() => expect(globe.settled()).toBe(true), { timeout: 10_000 })
    expect(drawnAt(map, smallPinLayer, a)).not.toEqual([])
    expect(reloaded).toBe(false)
  })

  it('redraws the halo in the new theme', async () => {
    const { globe } = openGlobe({ longitude: 0, latitude: 0, zoom: 2 })
    const glow = container.querySelector<HTMLElement>('.globe-glow')!

    globe.setTheme(themeWith((json) => (json.components.Globe.surface = '#ff0000')))

    expect(channels(getComputedStyle(glow).backgroundColor).slice(0, 3)).toEqual([255, 0, 0])
  })

  it('clusters small pins by the new theme’s glows, which a wider glow gathers from farther apart', async () => {
    const { globe, map } = openGlobe({ longitude: 0, latitude: 0, zoom: 2 })
    await new Promise((resolve) => map.once('idle', resolve))
    const [a, b] = [gameEastBy(map, 'A', -20), gameEastBy(map, 'B', 20)]
    globe.show([a, b])
    await pinsDrawn(map, smallPinLayer, a, b)

    globe.setTheme(themeWith((json) => (json.components.Pin.live.glow.radius = 60)))

    await pinsDrawn(map, pinClusterLayer, a, b)
  })

  it('measures score cards afresh in the new theme’s sizes, moving apart cards that now overlap', async () => {
    const { globe, map } = openGlobe({ longitude: 0, latitude: 0, zoom: cardZoom + 1 })
    await new Promise((resolve) => map.once('idle', resolve))
    // Room for two cards side by side, but not two cards twice as wide.
    const [a, b] = [gameEastBy(map, 'A', -70), gameEastBy(map, 'B', 70)]
    globe.show([a, b])
    await vi.waitFor(() => expect(globe.settled()).toBe(true), { timeout: 10_000 })
    expect(container.querySelector('[data-moved]')).toBeNull()

    const larger = themeWith((json) => (json.components.ScoreCard.size.minWidth = 200))
    // As the app does it: the page's CSS first, then the globe (see useTheme).
    applyTheme(document.documentElement, larger)
    globe.setTheme(larger)

    await vi.waitFor(() => expect(container.querySelector('[data-moved]')).not.toBeNull(), { timeout: 10_000 })
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
