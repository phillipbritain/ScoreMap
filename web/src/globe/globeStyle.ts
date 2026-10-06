import type { ExpressionSpecification, LayerSpecification, StyleSpecification } from 'maplibre-gl'
import { cardZoom } from './zoomLevels'

/** Free vector tiles with borders and place labels (ADR-0004). The globe keeps its data, not its look. */
export const baseStyleUrl = 'https://tiles.openfreemap.org/styles/liberty'

/** The globe's surface, land and sea alike. */
export const globeNavy = '#0b1526'

// Layers of the base style that the globe keeps.
const countryLines = 'boundary_2'
const stateLines = 'boundary_3'
const disputedLines = 'boundary_disputed'
const stateNames = 'label_state'
// City names, national capitals included; only major cities are named (see majorCity).
const cityNames = new Set(['label_city', 'label_city_capital'])
// Place names the globe leaves out: towns, villages and other small places.
const droppedNames = new Set(['label_town', 'label_village', 'label_other'])

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

/**
 * The globe's first place-name layer. Pins are added beneath it, so place names always draw over
 * them and stay readable.
 */
export function firstPlaceNameLayer(style: StyleSpecification): string | undefined {
  return style.layers.find((l) => l.type === 'symbol' && l['source-layer'] === 'place')?.id
}

/** A place name in the globe's colours: countries brighter than states and cities. */
function placeName(layer: LayerSpecification): LayerSpecification {
  const named = {
    ...(cityNames.has(layer.id) ? majorCitiesOnly(layer) : layer),
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
  return layer.id === stateNames ? { ...named, minzoom: 3, maxzoom: 8 } : named
}

/** A city ranked 1 (largest) to 4, such as New York, Dallas or Nashville; smaller cities aren't named. */
const majorCity: ExpressionSpecification = ['<=', ['coalesce', ['get', 'rank'], 99], 4]

/**
 * Names only major cities, at every zoom. Where two names would collide, the larger city (lower
 * rank) is placed first, so a nearby smaller city gives way.
 * The base style's fixed offset for its single anchor is dropped for the radial offset below.
 */
function majorCitiesOnly(layer: LayerSpecification): LayerSpecification {
  if (layer.type !== 'symbol') return layer
  const { 'text-anchor': _anchor, 'text-offset': _offset, ...layout } = layer.layout ?? {}
  return {
    ...layer,
    filter: ['all', (layer.filter as ExpressionSpecification | undefined) ?? true, majorCity],
    layout: {
      ...layout,
      'symbol-sort-key': ['coalesce', ['get', 'rank'], 99],
      // Below the city's dot by preference, clear of its own game's score card above the venue; if
      // another card covers that spot, the name moves to another side (see pinLayers' cardFootprint).
      'text-variable-anchor': ['top', 'bottom', 'left', 'right'],
      // Far enough from the dot (in ems) to clear a game's pin on it: a round small pin zoomed out,
      // a score card's pointer zoomed in.
      'text-radial-offset': ['step', ['zoom'], 1.2, cardZoom, 1],
    },
  }
}
