import type { GeoJSONSource, Map as MapLibreMap } from 'maplibre-gl'
import type { FeatureCollection, Polygon } from 'geojson'
import { ringAround, type GlobePoint } from './geo'
import { firstPlaceNameLayer } from './placeNames'

/** Rings on the globe around the venues: a local-run tool, from the behaviour tuner. */
export interface ReachRings {
  /** Rings each venue at this many kilometres, or shows none given no venues. */
  show(venues: readonly GlobePoint[], km: number): void
  remove(): void
}

const source = 'reach-rings'
// Red and dashed, unlike anything else on the globe, so the rings never pass for pins or borders.
const ringColour = '#ff3b3b'

/**
 * Rings drawn around venues on a map, as outlines only, under the pins and place names: to see how far a game's city
 * label may be from it (see cityLabels). A tool's own plain look, not the theme's. Made before the
 * pins' layers are added on each style load, so they go above it.
 */
export function addReachRings(map: MapLibreMap): ReachRings {
  let rings = features([], 0)
  // What the rings were last drawn for, so games changing only their scores redraw nothing.
  let ringsKey = ''

  const addLayers = () => {
    map.addSource(source, { type: 'geojson', data: rings })
    const below = firstPlaceNameLayer(map.getStyle())
    map.addLayer(
      {
        id: 'reach-ring-lines',
        type: 'line',
        source,
        paint: { 'line-color': ringColour, 'line-opacity': 0.9, 'line-width': 1.5, 'line-dasharray': [3, 2] },
      },
      below,
    )
  }
  map.on('style.load', addLayers)

  return {
    show(venues, km) {
      const key = `${km};${venues.map((venue) => `${venue.longitude},${venue.latitude}`).sort().join(';')}`
      if (key === ringsKey) return
      ringsKey = key
      rings = features(venues, km)
      map.getSource<GeoJSONSource>(source)?.setData(rings)
    },
    remove() {
      map.off('style.load', addLayers)
    },
  }
}

function features(venues: readonly GlobePoint[], km: number): FeatureCollection<Polygon> {
  return {
    type: 'FeatureCollection',
    features: venues.map((venue) => ({
      type: 'Feature',
      properties: {},
      geometry: { type: 'Polygon', coordinates: [ringAround(venue, km).map((p) => [p.longitude, p.latitude])] },
    })),
  }
}
