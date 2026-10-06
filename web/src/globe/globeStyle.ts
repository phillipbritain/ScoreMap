import type { ExpressionSpecification, LayerSpecification, StyleSpecification } from 'maplibre-gl'

/** Free vector tiles with borders and place labels (ADR-0004). The globe keeps its data, not its look. */
export const baseStyleUrl = 'https://tiles.openfreemap.org/styles/liberty'

/** The globe's surface, land and sea alike. */
export const globeNavy = '#0b1526'

// Layers of the base style that the globe keeps.
const countryLines = 'boundary_2'
const stateLines = 'boundary_3'
const disputedLines = 'boundary_disputed'
const stateNames = 'label_state'
const cityNames = 'label_city'
// Place names the globe leaves out: villages and other small places.
const droppedNames = new Set(['label_village', 'label_other'])

/**
 * The globe's dark look, made from the base style: a plain navy globe where only thin light lines
 * show coastlines, country borders and state lines, with quiet grey place names. Land and sea are
 * the same colour. Everything else in the base style (roads, buildings, land cover) is dropped.
 */
export function globeStyle(base: StyleSpecification): StyleSpecification {
  const byId = new Map(base.layers.map((layer) => [layer.id, layer]))
  const layer = (id: string) => {
    const found = byId.get(id)
    if (!found) throw new Error(`The base map style has no layer "${id}"`)
    return found
  }
  const line = (id: string, changes: Partial<LayerSpecification>): LayerSpecification =>
    ({ ...layer(id), ...changes }) as LayerSpecification

  const placeNames = base.layers
    .filter((l) => l.type === 'symbol' && l['source-layer'] === 'place' && !droppedNames.has(l.id))
    .map((l) => placeName(l))
  layer(stateNames) // Fails loudly if the base style renames it, rather than silently losing state names.

  return {
    ...base,
    // MapLibre's own atmosphere is lit from one side; the globe gets an even halo instead (globeGlow.ts).
    sky: { 'atmosphere-blend': 0 },
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
      line(stateLines, {
        minzoom: 0,
        paint: {
          'line-color': 'rgba(255, 255, 255, 0.3)',
          'line-width': ['interpolate', ['linear'], ['zoom'], 3, 0.5, 8, 1],
        },
      }),
      line(countryLines, {
        paint: {
          'line-color': 'rgba(255, 255, 255, 0.7)',
          'line-width': ['interpolate', ['linear'], ['zoom'], 2, 0.6, 8, 1.4],
        },
      }),
      line(disputedLines, {
        paint: { 'line-color': 'rgba(255, 255, 255, 0.5)', 'line-dasharray': [2, 2], 'line-width': 0.8 },
      }),
      ...placeNames,
    ],
  }
}

/** A place name in the globe's colours: countries brighter than states and cities. */
function placeName(layer: LayerSpecification): LayerSpecification {
  const named = {
    ...layer,
    paint: {
      ...(layer.type === 'symbol' ? layer.paint : {}),
      'text-color': layer.id.startsWith('label_country') ? '#c9d2e0' : '#8f9bb0',
      'text-halo-color': globeNavy,
      'text-halo-width': 1.2,
      'text-halo-blur': 0,
    },
  } as LayerSpecification
  // State names from zoom 3 (about one country on screen) until city names take over past zoom 8;
  // the base style starts them at zoom 5.
  if (layer.id === stateNames) return { ...named, minzoom: 3, maxzoom: 8 }
  if (layer.id === cityNames && layer.type === 'symbol') {
    return { ...named, filter: ['all', layer.filter ?? true, largeEnoughCity] } as LayerSpecification
  }
  return named
}

/**
 * Zoomed out, only the larger cities are named, adding smaller ones as the viewer zooms in. Cities
 * are ranked from 1 (largest) down; national capitals have their own layer and aren't thinned.
 */
const largeEnoughCity: ExpressionSpecification = [
  '<=',
  ['coalesce', ['get', 'rank'], 99],
  ['step', ['zoom'], 2, 4, 3, 5, 4, 6, 6, 7, 99],
]
