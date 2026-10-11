import type {
  DataDrivenPropertyValueSpecification,
  ExpressionSpecification,
  FilterSpecification,
  LayerSpecification,
  Map as MapLibreMap,
  MapSourceDataEvent,
  StyleSpecification,
} from 'maplibre-gl'
import type { Game } from '../games/game'
import type { GlobeFont } from '../theme/globeFonts'
import { zoomStops, type Theme } from '../theme/theme'
import { cityNameBox, cityOfPlace, gameCities, type City, type ScreenBox } from './gameCities'
import { degreesApart } from './geo'
import { isBehindGlobe } from './horizon'
import { cardZoom } from './zoomLevels'

// Name layers of the base style.
const stateNames = 'label_state'
// City names, national capitals included; only major cities are named (see majorCity), and other
// cities only where a game is (see gameCityName).
const cityNames = new Set(['label_city', 'label_city_capital'])
// Towns and villages, named only where a game is.
const townNames = new Set(['label_town', 'label_village'])
// Place names the globe leaves out: towns, villages (but for games') and other small places.
const droppedNames = new Set([...townNames, 'label_other'])

/** The tiles' source and layer of places, cities among them. */
const placeTiles = { source: 'openmaptiles', sourceLayer: 'place' }

/**
 * The base style's place names in the theme's colours, outlines and fonts, by kind of place. Major cities
 * are named, and also the place where each game is, however small, in layers of their own that are
 * placed before every other name. Goes after the globe's lines, the game cities' names last.
 */
export function placeNameLayers(base: StyleSpecification, theme: Theme): LayerSpecification[] {
  if (!base.layers.some((l) => l.id === stateNames)) {
    // Fails loudly if the base style renames it, rather than silently losing state names.
    throw new Error(`The base map style has no layer "${stateNames}"`)
  }
  const names = base.layers
    .filter((l) => l.type === 'symbol' && l['source-layer'] === placeTiles.sourceLayer && !droppedNames.has(l.id))
    .map((l) => placeName(l, theme))
    .map((l) => (cityNames.has(l.id) ? exceptGameCities(majorCitiesOnly(cityNamePlacement(l))) : l))
  // Last, so they're placed first: every other name gives way to them.
  const gameCityNames = base.layers
    .filter((l) => cityNames.has(l.id) || townNames.has(l.id))
    .map((l) => gameCityName(cityNamePlacement(placeName(l, theme))))
  return [...names, ...gameCityNames]
}

/**
 * The globe's first place-name layer. Pins are added beneath it, so place names always draw over
 * them and stay readable.
 */
export function firstPlaceNameLayer(style: StyleSpecification): string | undefined {
  return style.layers.find((l) => l.type === 'symbol' && l['source-layer'] === placeTiles.sourceLayer)?.id
}

const zoomBase = 1.2

const zoomed = (...stops: number[]): DataDrivenPropertyValueSpecification<number> => [
  'interpolate',
  ['exponential', zoomBase],
  ['zoom'],
  ...stops,
]

/** The kinds of place the globe names, each with its own look in the theme. */
type PlaceKind = keyof Theme['placeNames']

/**
 * States and countries in spaced capitals, with this much tracking in ems; city names as they are.
 * Their colours, outlines, fonts and sizes come from the theme.
 */
const capitals: Partial<Record<PlaceKind, number>> = { state: 0.25, country: 0.12 }

/** A kind of place's text sizes in the theme, as zoom, size stops (see zoomed), by zoom. */
const sizeStops = (kind: PlaceKind, theme: Theme): number[] => zoomStops(theme.placeNames[kind].size).flat()

function placeKind(layerId: string): PlaceKind {
  if (layerId === 'label_city_capital') return 'capital'
  if (layerId === stateNames) return 'state'
  if (layerId.startsWith('label_country')) return 'country'
  return 'city'
}

/** A place name in the theme's look for its kind of place, in spaced capitals or not (see capitals). */
function placeName(layer: LayerSpecification, theme: Theme): LayerSpecification {
  const kind = placeKind(layer.id)
  const tracking = capitals[kind]
  const look = theme.placeNames[kind]
  const named = {
    ...layer,
    layout: {
      ...(layer.type === 'symbol' ? layer.layout : {}),
      'text-font': [look.font.name],
      'text-size': zoomed(...sizeStops(kind, theme)),
      'text-transform': tracking === undefined ? 'none' : 'uppercase',
      'text-letter-spacing': tracking ?? 0,
    },
    paint: {
      ...(layer.type === 'symbol' ? layer.paint : {}),
      'text-color': look.color,
      'text-halo-color': look.outline.color,
      'text-halo-width': look.outline.width,
      'text-halo-blur': look.outline.blur,
    },
  } as LayerSpecification
  // State names from zoom 3 (about one country on screen) until city names take over past zoom 8;
  // the base style starts them at zoom 5. Unseen until all of them in view fit (see showStateNamesWhenAllFit).
  return layer.id === stateNames ? hiddenStateNames({ ...named, minzoom: 3, maxzoom: 8 }) : named
}

function hiddenStateNames(layer: LayerSpecification): LayerSpecification {
  if (layer.type !== 'symbol') return layer
  return { ...layer, paint: { ...layer.paint, 'text-opacity': 0, 'text-opacity-transition': { duration: 300 } } }
}

/** A city ranked 1 (largest) to 4, such as New York, Dallas or Nashville; smaller cities aren't named. */
const majorCity: ExpressionSpecification = ['<=', ['coalesce', ['get', 'rank'], 99], 4]

/** The places a game's venue can be named by, among the tiles' places: cities, towns and villages. */
export const gameCityPlaces: ExpressionSpecification = ['in', ['get', 'class'], ['literal', ['city', 'town', 'village']]]

/**
 * Names only major cities, at every zoom. Where two names would collide, the larger city (lower
 * rank) is placed first, so a nearby smaller city gives way.
 */
function majorCitiesOnly(layer: LayerSpecification): LayerSpecification {
  if (layer.type !== 'symbol') return layer
  return {
    ...layer,
    filter: ['all', (layer.filter as ExpressionSpecification | undefined) ?? true, majorCity],
    layout: { ...layer.layout, 'symbol-sort-key': ['coalesce', ['get', 'rank'], 99] },
  }
}

/**
 * Where a city's name goes around its dot. The base style's fixed offset for its single anchor is
 * dropped for the radial offset below.
 */
function cityNamePlacement(layer: LayerSpecification): LayerSpecification {
  if (layer.type !== 'symbol') return layer
  const { 'text-anchor': _anchor, 'text-offset': _offset, ...layout } = layer.layout ?? {}
  return {
    ...layer,
    layout: {
      ...layout,
      // Below the city's dot by preference, clear of its own game's score card above the venue; if
      // another card covers that spot, the name moves to another side (see cardLayoutLayers' cardFootprint).
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
 * The global state listing the places named for their games (see gameCities), by their features'
 * ids: cities, towns or villages. Their names always show, below their dots, and nothing else is
 * written over them: score cards are laid out around them, and trails pass beneath them.
 */
export const gameCitiesState = 'gameCities'
const isGameCity: ExpressionSpecification = ['in', ['id'], ['global-state', gameCitiesState]]

/** The style's global state the place names read, as it starts: no places named for games yet. */
export const placeNameState: StyleSpecification['state'] = { [gameCitiesState]: { default: [] } }

/**
 * A place name layer's twin for the places named for their games, whatever their size; the city
 * layers themselves leave them out, and town and village names show only here.
 */
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

/**
 * How a city's name looks at a zoom level: a capital's or another city's, worked out from the same
 * theme the map draws it with.
 */
export function cityNameLook(zoom: number, capital: boolean, theme: Theme): CityNameLook {
  const kind = capital ? 'capital' : 'city'
  const size = atZoom(sizeStops(kind, theme), zoom)
  return {
    font: cssFont(theme.placeNames[kind].font, size),
    size,
    offset: (zoom < cardZoom ? cityNameOffset.small : cityNameOffset.card) * size,
    maxWidth: cityNameMaxWidth * size,
  }
}
/** A globe font as a CSS font at this size, for measuring text in it on the page. */
const cssFont = ({ family, weight, style }: GlobeFont, size: number) => `${style} ${weight} ${size}px "${family}", sans-serif`

// The base style wraps city names wider than this many ems.
const cityNameMaxWidth = 8

/** The value of a zoomed() expression at a zoom level, as MapLibre works it out. */
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

/** The place names on a map with the globe's style. */
export interface PlaceNames {
  /** Names the places where these games are, however small (see gameCities). */
  showGames(games: readonly Game[]): void
  /**
   * Where the names of the games' places are written on screen, for cards to keep clear of: those on
   * the side of the globe facing the viewer, as MapLibre writes no others.
   */
  nameBoxes(): ScreenBox[]
  remove(): void
}

/**
 * Keeps the place names on a map up to date: names the games' places as their tiles load, and shows
 * state names only while all of them fit (see showStateNamesWhenAllFit).
 */
export function addPlaceNames(map: MapLibreMap, theme: Theme): PlaceNames {
  let games: readonly Game[] = []
  let cities: City[] = []
  // True when the games or the map's loaded places have changed since the cities were found.
  let stale = true

  /**
   * Finds the place named for each game among the places loaded so far, however small, and has the
   * map always write those places' names (see gameCityName).
   */
  const findCities = () => {
    if (!stale || !map.getSource(placeTiles.source)) return
    stale = false
    const places = new Map<number, City>()
    for (const feature of map.querySourceFeatures(placeTiles.source, {
      sourceLayer: placeTiles.sourceLayer,
      filter: gameCityPlaces,
    })) {
      const city = cityOfPlace(feature)
      if (city && !places.has(city.id)) places.set(city.id, city)
    }
    const found = gameCities(
      games.map((game) => game.venue),
      [...places.values()],
    )
    const ids = found.map((city) => city.id).sort((a, b) => a - b)
    if (ids.join() !== cities.map((city) => city.id).sort((a, b) => a - b).join()) {
      map.setGlobalStateProperty(gameCitiesState, ids)
    }
    cities = found
  }
  // New place tiles may hold a game's place.
  const onSourceData = (event: MapSourceDataEvent) => {
    if (event.sourceId === placeTiles.source && event.tile) stale = true
  }
  map.on('sourcedata', onSourceData)
  map.on('render', findCities)
  const stopStateNameFit = showStateNamesWhenAllFit(map)

  return {
    showGames(next) {
      games = next
      stale = true
      findCities()
    },
    nameBoxes() {
      const zoom = map.getZoom()
      return cities
        .filter((city) => !isBehindGlobe(map, [city.longitude, city.latitude]))
        .map((city) =>
          cityNameBox(city, map.project([city.longitude, city.latitude]), cityNameLook(zoom, city.capital, theme), measureText),
        )
    },
    remove() {
      map.off('sourcedata', onSourceData)
      map.off('render', findCities)
      stopStateNameFit()
    },
  }
}

// Made when first needed, so the module loads where there's no page (in tests, say).
let measuring: CanvasRenderingContext2D | null | undefined

/**
 * A line's width in a font, in pixels. The map writes its fonts from its own glyphs, which the page
 * doesn't have; the browser's fallback sans-serif measures a little wider than Open Sans, which errs
 * on the side of room.
 */
function measureText(text: string, font: string): number {
  measuring ??= document.createElement('canvas').getContext('2d')
  if (!measuring) return text.length * fallbackLetterWidth * parseFloat(font.split(' ')[2])
  measuring.font = font
  return measuring.measureText(text).width
}
// A letter's width in ems, roughly, where there's no canvas to measure with.
const fallbackLetterWidth = 0.6

// How often to check whether state names fit, at most: often enough to follow the globe as it
// turns, rarely enough not to slow it.
const checkEveryMs = 250

/**
 * Shows state names all or none: only while every state name in view fits, clear of every other
 * name, card and pin. Where any would give way, none show, so the map never names some states and
 * not their neighbours. The names are still placed while unseen (see hiddenStateNames), which is how
 * the map tells whether they'd fit; being the last names placed, they never push another name aside.
 * Returns a function that stops it.
 */
function showStateNamesWhenAllFit(map: MapLibreMap): () => void {
  let shown = false
  let lastCheck = 0
  const check = () => {
    lastCheck = performance.now()
    const show = allStateNamesFit(map)
    if (show === shown || !map.getLayer(stateNames)) return
    shown = show
    map.setPaintProperty(stateNames, 'text-opacity', show ? 1 : 0)
  }
  const checkNowAndThen = () => {
    if (performance.now() - lastCheck >= checkEveryMs) check()
  }
  map.on('render', checkNowAndThen)
  // Once more when the map settles, which the checks along the way may have just missed.
  map.on('idle', check)
  return () => {
    map.off('render', checkNowAndThen)
    map.off('idle', check)
  }
}

/** Whether every state in view has its name placed: none dropped for want of room. */
function allStateNamesFit(map: MapLibreMap): boolean {
  const layer = map.getLayer(stateNames)
  if (!layer) return false
  const zoom = map.getZoom()
  if (zoom < layer.minzoom || zoom >= layer.maxzoom) return false

  const inView = new Set<string | number>()
  const canvas = map.getCanvas()
  const centre = map.getCenter()
  for (const { id, geometry } of map.querySourceFeatures(placeTiles.source, {
    sourceLayer: placeTiles.sourceLayer,
    filter: map.getFilter(stateNames) as FilterSpecification | undefined,
  })) {
    if (id === undefined || inView.has(id) || geometry.type !== 'Point') continue
    const [longitude, latitude] = geometry.coordinates
    // On the near side of the globe; the far side projects onto the screen too.
    if (degreesApart({ longitude: centre.lng, latitude: centre.lat }, { longitude, latitude }) >= 90) continue
    const { x, y } = map.project([longitude, latitude])
    if (x >= 0 && x <= canvas.clientWidth && y >= 0 && y <= canvas.clientHeight) inView.add(id)
  }
  if (inView.size === 0) return false

  const placed = new Set(map.queryRenderedFeatures({ layers: [stateNames] }).map((f) => f.id))
  return [...inView].every((id) => placed.has(id))
}
