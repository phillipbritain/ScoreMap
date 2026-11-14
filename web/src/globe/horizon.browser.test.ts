import { Map as MapLibreMap, setWorkerUrl, type GeoJSONSource, type StyleSpecification } from 'maplibre-gl'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
import type { FeatureCollection, Point } from 'geojson'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fadedByHorizon, fadeNearHorizon, globeView, horizonFade } from './horizon'

// MapLibre's default worker path doesn't survive Vite's bundling (see globeMap).
setWorkerUrl(workerUrl)

const source = 'pins'

/** A globe with one source of points, drawn faded near the horizon as the app's pins are. */
const style: StyleSpecification = {
  version: 8,
  projection: { type: 'globe' },
  sources: { [source]: { type: 'geojson', data: { type: 'FeatureCollection', features: [] }, promoteId: 'gameId' } },
  layers: [
    { id: 'background', type: 'background', paint: { 'background-color': '#0b1526' } },
    { id: 'pins', type: 'circle', source, paint: { 'circle-radius': 6, 'circle-opacity': fadedByHorizon() } },
  ],
}

/** Points with these ids at these [longitude, latitude]s, each its id by its gameId, as the app's pins are. */
function points(...at: [id: string, longitude: number, latitude: number][]): FeatureCollection<Point> {
  return {
    type: 'FeatureCollection',
    features: at.map(([gameId, longitude, latitude]) => ({ type: 'Feature', properties: { gameId }, geometry: { type: 'Point', coordinates: [longitude, latitude] } })),
  }
}

let container: HTMLElement
let map: MapLibreMap
// The fade each frame drew a feature at, by id, read before the fade is worked out for the next.
let drawn: Map<string, (number | undefined)[]>

beforeEach(async () => {
  container = document.createElement('div')
  container.style.cssText = 'position: relative; width: 800px; height: 600px'
  document.body.append(container)
  map = new MapLibreMap({ container, style, center: [0, 0], zoom: 3, attributionControl: false, fadeDuration: 0 })
  drawn = new Map()
  // Before fadeNearHorizon's own, so it reads the fade the frame was drawn with.
  map.on('render', () => {
    for (const feature of map.querySourceFeatures(source)) {
      const id = String(feature.id)
      const fade = map.getFeatureState({ source, id }).horizonFade as number | undefined
      drawn.set(id, [...(drawn.get(id) ?? []), fade])
    }
  })
  await map.once('load')
  fadeNearHorizon(map, [source])
})

afterEach(() => {
  map.remove()
  container.remove()
})

/** Gives the source these points and waits until a frame has drawn the one with this id. */
async function show(data: FeatureCollection<Point>, id?: string) {
  drawn.clear()
  map.getSource<GeoJSONSource>(source)!.setData(data)
  if (id) await vi.waitFor(() => expect(drawn.get(id)?.length).toBeGreaterThan(0))
  else await map.once('idle')
}

// Looking at 0°, 0° at zoom 3: whole at the center, gone 55° east, short of the horizon (about 65°).
const center: [number, number] = [0, 0]
const nearHorizon: [number, number] = [55, 0]

describe('fadeNearHorizon', () => {
  it('fades a point near the horizon out and leaves one at the center whole', () => {
    const view = globeView(map)
    expect(horizonFade(view, { longitude: nearHorizon[0], latitude: nearHorizon[1] })).toBe(0)
    expect(horizonFade(view, { longitude: center[0], latitude: center[1] })).toBe(1)
  })

  it('draws a point new to the source faded from its first frame', async () => {
    await show(points(['A', ...nearHorizon]), 'A')

    expect(drawn.get('A')![0]).toBe(0)
  })

  it('draws a point back in the source at its fade where it is now from its first frame, not the one it had before', async () => {
    // The point near the horizon, faded out; then gone, as a game into a score card's reach; then back
    // at the center, as an outer pin cluster's id comes back for another cluster somewhere else.
    await show(points(['A', ...nearHorizon]), 'A')
    await vi.waitFor(() => expect(map.getFeatureState({ source, id: 'A' }).horizonFade).toBe(0))
    await show(points())

    await show(points(['A', ...center]), 'A')

    expect(drawn.get('A')![0]).toBe(1)
  })
})
