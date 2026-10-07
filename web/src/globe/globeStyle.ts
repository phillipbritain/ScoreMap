import type { LayerSpecification, StyleSpecification } from 'maplibre-gl'
import { glyphsUrl, placeNameLayers, placeNameState } from './placeNames'

/** Free vector tiles with borders and place labels (ADR-0004). The globe keeps its data, not its look. */
export const baseStyleUrl = 'https://tiles.openfreemap.org/styles/liberty'

/** The globe's surface, land and sea alike. */
export const globeNavy = '#0b1526'

// Layers of the base style that the globe keeps.
const countryLines = 'boundary_2'
const stateLines = 'boundary_3'
const disputedLines = 'boundary_disputed'

/**
 * The globe's dark look, made from the base style: a plain navy globe where only thin light lines
 * show coastlines, country borders and state lines, with warm cream place names (see placeNames).
 * Land and sea are the same colour. Everything else in the base style (roads, buildings, land
 * cover) is dropped.
 */
export function globeStyle(base: StyleSpecification): StyleSpecification {
  const byId = new Map(base.layers.map((layer) => [layer.id, layer]))
  const layer = (id: string) => {
    const found = byId.get(id)
    if (!found) throw new Error(`The base map style has no layer "${id}"`)
    return found
  }
  const restyled = (id: string, changes: Partial<LayerSpecification>): LayerSpecification =>
    ({ ...layer(id), ...changes }) as LayerSpecification

  return {
    ...base,
    glyphs: glyphsUrl,
    // MapLibre's own atmosphere is lit from one side; the globe gets an even halo instead (globeGlow.ts).
    sky: { 'atmosphere-blend': 0 },
    state: { ...base.state, ...placeNameState },
    layers: [
      { id: 'background', type: 'background', paint: { 'background-color': globeNavy } },
      // Coastlines: the edges of the sea, which is the same colour as the land. Lakes and rivers
      // aren't outlined; at a distance they read as clutter.
      {
        id: 'coastline',
        type: 'line',
        source: 'openmaptiles',
        'source-layer': 'water',
        filter: ['==', ['get', 'class'], 'ocean'],
        paint: {
          'line-color': 'rgba(255, 255, 255, 0.7)',
          'line-width': ['interpolate', ['linear'], ['zoom'], 2, 0.6, 8, 1.2],
        },
      },
      // The base style hides state and province lines below zoom 5; the tiles carry them from zoom 1.
      restyled(stateLines, {
        minzoom: 0,
        paint: {
          'line-color': 'rgba(255, 255, 255, 0.3)',
          'line-width': ['interpolate', ['linear'], ['zoom'], 3, 0.5, 8, 1],
        },
      }),
      restyled(countryLines, {
        paint: {
          'line-color': 'rgba(255, 255, 255, 0.7)',
          'line-width': ['interpolate', ['linear'], ['zoom'], 2, 0.6, 8, 1.4],
        },
      }),
      restyled(disputedLines, {
        paint: { 'line-color': 'rgba(255, 255, 255, 0.5)', 'line-dasharray': [2, 2], 'line-width': 0.8 },
      }),
      ...placeNameLayers(base),
    ],
  }
}
