import type {
  DataDrivenPropertyValueSpecification,
  ExpressionSpecification,
  LayerSpecification,
  StyleSpecification,
} from 'maplibre-gl'
import { cardZoom } from './zoomLevels'

/** Free vector tiles with borders and place labels (ADR-0004). The globe keeps its data, not its look. */
export const baseStyleUrl = 'https://tiles.openfreemap.org/styles/liberty'

/**
 * Free map fonts, Open Sans among them (ADR-0006); OpenFreeMap, the base style's own font source,
 * only has Noto Sans. Every text on the globe, cluster counts included, must use a font this source
 * has: for one it lacks, it answers with a web page rather than an error, and the text falls back
 * to a browser font.
 */
export const glyphsUrl = 'https://fonts.openmaptiles.org/{fontstack}/{range}.pbf'

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
 * show coastlines, country borders and state lines, with warm cream place names. Land and sea are
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

  const named = base.layers
    .filter((l) => l.type === 'symbol' && l['source-layer'] === 'place' && !droppedNames.has(l.id))
    .map((l) => placeName(l))
  const placeNames = named.map((l) => (cityNames.has(l.id) ? exceptGameCities(l) : l))
  // Last, so they're placed first: every other name gives way to them.
  const gameCityNames = named.filter((l) => cityNames.has(l.id)).map(gameCityName)
  layer(stateNames) // Fails loudly if the base style renames it, rather than silently losing state names.

  return {
    ...base,
    glyphs: glyphsUrl,
    // MapLibre's own atmosphere is lit from one side; the globe gets an even halo instead (globeGlow.ts).
    sky: { 'atmosphere-blend': 0 },
    state: { ...base.state, [gameCitiesState]: { default: [] } },
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
      ...gameCityNames,
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

// Place names, "warm night": cream on a dark outline, in Open Sans.
const darkOutline = '#050b16'
// City name sizes in pixels, as zoom, size stops (see zoomed).
const cityNameSizes = { city: [4, 12, 7, 14, 11, 18], capital: [4, 12.5, 7, 15, 11, 19] }
const zoomBase = 1.2

const zoomed = (...stops: number[]): DataDrivenPropertyValueSpecification<number> => [
  'interpolate',
  ['exponential', zoomBase],
  ['zoom'],
  ...stops,
]

interface NameStyle {
  font: string
  size: DataDrivenPropertyValueSpecification<number>
  color: string
  /** Spaced capitals, with this much tracking in ems. */
  capitals?: number
  outline: { width: number; blur: number }
}

/** Cities brightest; capitals a touch bolder; states muted gold capitals that sit back; countries spaced capitals. */
const nameStyles = {
  city: {
    font: 'Open Sans Semibold',
    size: zoomed(...cityNameSizes.city),
    color: '#f1e6cc',
    outline: { width: 2, blur: 0.5 },
  },
  capital: {
    font: 'Open Sans Bold',
    size: zoomed(...cityNameSizes.capital),
    color: '#fff4dc',
    outline: { width: 2, blur: 0.5 },
  },
  state: {
    font: 'Open Sans Regular',
    size: zoomed(3, 9, 8, 13),
    color: '#9a8a62',
    capitals: 0.25,
    outline: { width: 1.2, blur: 0 },
  },
  country: {
    font: 'Open Sans Bold',
    size: zoomed(1, 9, 4, 16),
    color: '#d8c9a4',
    capitals: 0.12,
    outline: { width: 2, blur: 0.5 },
  },
} satisfies Record<string, NameStyle>

function nameStyle(layerId: string): NameStyle {
  if (layerId === 'label_city_capital') return nameStyles.capital
  if (layerId === stateNames) return nameStyles.state
  if (layerId.startsWith('label_country')) return nameStyles.country
  return nameStyles.city
}

/** A place name in the globe's look (see nameStyles). */
function placeName(layer: LayerSpecification): LayerSpecification {
  const placed = cityNames.has(layer.id) ? majorCitiesOnly(layer) : layer
  const style = nameStyle(layer.id)
  const named = {
    ...placed,
    layout: {
      ...(placed.type === 'symbol' ? placed.layout : {}),
      'text-font': [style.font],
      'text-size': style.size,
      'text-transform': style.capitals === undefined ? 'none' : 'uppercase',
      'text-letter-spacing': style.capitals ?? 0,
    },
    paint: {
      ...(layer.type === 'symbol' ? layer.paint : {}),
      'text-color': style.color,
      'text-halo-color': darkOutline,
      'text-halo-width': style.outline.width,
      'text-halo-blur': style.outline.blur,
    },
  } as LayerSpecification
  // State names from zoom 3 (about one country on screen) until city names take over past zoom 8;
  // the base style starts them at zoom 5.
  return layer.id === stateNames ? { ...named, minzoom: 3, maxzoom: 8 } : named
}

/** A city ranked 1 (largest) to 4, such as New York, Dallas or Nashville; smaller cities aren't named. */
const majorCity: ExpressionSpecification = ['<=', ['coalesce', ['get', 'rank'], 99], 4]

/** The cities the map names, among the tiles' places. */
export const namedCity: ExpressionSpecification = ['all', ['==', ['get', 'class'], 'city'], majorCity]
/** The tiles' source and layer of places, cities among them. */
export const placeTiles = { source: 'openmaptiles', sourceLayer: 'place' }

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
      'text-radial-offset': ['step', ['zoom'], cityNameOffset.small, cardZoom, cityNameOffset.card],
    },
  }
}

// How far a city's name sits from its dot, in ems: clear of a round small pin zoomed out, a score
// card's pointer zoomed in.
const cityNameOffset = { small: 1.2, card: 1 }

/**
 * The global state listing the cities named for their games (see gameCities), by their features' ids.
 * Their names always show, below their dots, and nothing else is written over them; score cards and
 * trails are laid out around them.
 */
export const gameCitiesState = 'gameCities'
const isGameCity: ExpressionSpecification = ['in', ['id'], ['global-state', gameCitiesState]]

/** A city name layer's twin for the cities named for their games; the layer itself leaves them out. */
function gameCityName(layer: LayerSpecification): LayerSpecification {
  if (layer.type !== 'symbol') return layer
  return {
    ...layer,
    id: `${layer.id}_game`,
    filter: ['all', layer.filter as ExpressionSpecification, isGameCity],
    // Always below the dot, where cards are laid out around it, and written whatever else is there.
    layout: { ...layer.layout, 'text-variable-anchor': ['top'], 'text-allow-overlap': true },
  }
}

/** Leaves the cities named for their games to gameCityName's layers. */
function exceptGameCities(layer: LayerSpecification): LayerSpecification {
  if (layer.type !== 'symbol') return layer
  return { ...layer, filter: ['all', layer.filter as ExpressionSpecification, ['!', isGameCity]] }
}

/** Where and how big a city's name is written below its dot, so cards can keep clear of it. */
export interface CityNameLook {
  /** The font, as a CSS font for measuring the name. */
  font: string
  /** The text's size in pixels. */
  size: number
  /** How far the name's top sits below the city's dot, in pixels. */
  offset: number
  /** The widest a line gets before the name wraps, in pixels. */
  maxWidth: number
}

/** How a city's name looks at a zoom level: a capital's or another city's (see nameStyles). */
export function cityNameLook(zoom: number, capital: boolean): CityNameLook {
  const size = atZoom(capital ? cityNameSizes.capital : cityNameSizes.city, zoom)
  return {
    font: `${capital ? 700 : 600} ${size}px "Open Sans", sans-serif`,
    size,
    offset: (zoom < cardZoom ? cityNameOffset.small : cityNameOffset.card) * size,
    maxWidth: cityNameMaxWidth * size,
  }
}
// The base style wraps city names wider than this many ems.
const cityNameMaxWidth = 8

/** The value of a zoomed() expression at a zoom level. */
function atZoom(stops: readonly number[], zoom: number): number {
  if (zoom <= stops[0]) return stops[1]
  for (let i = 2; i < stops.length; i += 2) {
    const [z0, v0, z1, v1] = stops.slice(i - 2, i + 2)
    if (zoom > z1) continue
    const t = (zoomBase ** (zoom - z0) - 1) / (zoomBase ** (z1 - z0) - 1)
    return v0 + (v1 - v0) * t
  }
  return stops[stops.length - 1]
}
