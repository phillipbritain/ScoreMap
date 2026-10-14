import type {
  DataDrivenPropertyValueSpecification,
  GeoJSONSource,
  GeoJSONSourceSpecification,
  LayerSpecification,
  Map as MapLibreMap,
  StyleSpecification,
  SymbolLayerSpecification,
} from 'maplibre-gl'
import type { Feature, FeatureCollection, Point } from 'geojson'
import type { Game } from '../games/game'
import type { GlobeFont } from '../theme/globeFonts'
import { zoomStops, type Theme } from '../theme/theme'
import { cityLabels, cityList, type CityLabelSettings, type CityLabels, type ListedCity } from './cityLabels'
import { cityNameBox, type ScreenBox } from './cityNameBox'
import type { GlobePoint } from './geo'
import { isBehindGlobe } from './horizon'
import { cardZoom } from './zoomLevels'

// Place names of the base style the globe drops: its cities and capitals (city names are all the
// globe's own, from the city list: see cityNameLayers), towns, villages and other small places.
const droppedNames = new Set(['label_city', 'label_city_capital', 'label_town', 'label_village', 'label_other'])

/** The tiles' source layer of places: the base style's place names, such as states and countries. */
const placeTiles = 'place'

/** The source of the cities the globe names, from the city list (see cityLabels). */
export const cityNameSource = 'cityNames'

/** The city name source as the style starts it, empty until addPlaceNames fills it. */
export const cityNameSourceSpec: GeoJSONSourceSpecification = { type: 'geojson', data: { type: 'FeatureCollection', features: [] } }

/**
 * The globe's place names: the base style's states and countries, and the city names from the city
 * list (see cityNameLayers), each in the theme's look for its kind of place. Big cities with no game
 * near come first, so every other name is placed before them; the games' cities come last, placed
 * before everything. Goes after the globe's lines.
 */
export function placeNameLayers(base: StyleSpecification, theme: Theme): LayerSpecification[] {
  const names = base.layers
    .filter((l) => l.type === 'symbol' && l['source-layer'] === placeTiles && !droppedNames.has(l.id))
    .map((l) => placeName(l, l.id.startsWith('label_country') ? 'country' : 'state', theme))
  const { big, game } = cityNameLayers(theme)
  return [...big, ...names, ...game]
}

/**
 * The globe's first place-name layer. Pins are added beneath it, so place names always draw over
 * them and stay readable.
 */
export function firstPlaceNameLayer(style: StyleSpecification): string | undefined {
  return style.layers.find((l) => l.type === 'symbol' && (l.source === cityNameSource || l['source-layer'] === placeTiles))?.id
}

const zoomBase = 1.2

const zoomed = (...stops: number[]): DataDrivenPropertyValueSpecification<number> => [
  'interpolate',
  ['exponential', zoomBase],
  ['zoom'],
  ...stops,
]

/** The kinds of place the globe names, each with its own look in the theme. */
type PlaceKind = keyof Theme['components']['PlaceNames']

/**
 * States and countries in capitals; city names as they are. Their colours, outlines, fonts, sizes and
 * letter spacing come from the theme.
 */
const capitals: ReadonlySet<PlaceKind> = new Set(['state', 'country'])

/** A kind of place's text sizes in the theme, as zoom, size stops (see zoomed), by zoom. */
const sizeStops = (kind: PlaceKind, theme: Theme): number[] => zoomStops(theme.components.PlaceNames[kind].size).flat()

/** A place name in the theme's look for its kind of place, in capitals or not (see capitals). */
function placeName(layer: LayerSpecification, kind: PlaceKind, theme: Theme): LayerSpecification {
  const look = theme.components.PlaceNames[kind]
  return {
    ...layer,
    layout: {
      ...(layer.type === 'symbol' ? layer.layout : {}),
      'text-font': [look.font.name],
      'text-size': zoomed(...sizeStops(kind, theme)),
      'text-transform': capitals.has(kind) ? 'uppercase' : 'none',
      'text-letter-spacing': look.letterSpacing,
    },
    paint: {
      ...(layer.type === 'symbol' ? layer.paint : {}),
      'text-color': look.color,
      'text-halo-color': look.outline.color,
      'text-halo-width': look.outline.width,
      'text-halo-blur': look.outline.blur,
    },
  } as LayerSpecification
}

// City names show from this zoom, as the base style's do.
const cityNameMinZoom = 3

/** The city name layers' ids: Big cities with no game near, and the games' cities, by kind. */
const cityNameLayerIds = {
  big: { city: 'city_names', capital: 'capital_names' },
  game: { city: 'city_names_game', capital: 'capital_names_game' },
} as const

/**
 * The layers naming the cities in the city name source (see addPlaceNames), from zoom 3, each with
 * the base style's city dot and in the theme's city or capital look. The games' cities are always
 * written below their dots, whatever else is there, and cards are laid out around them. Big cities
 * with no game near are written where they have room, most populous first, giving way to cards and
 * other names.
 */
function cityNameLayers(theme: Theme): { big: LayerSpecification[]; game: LayerSpecification[] } {
  const layer = (game: boolean, kind: 'city' | 'capital'): LayerSpecification => {
    const city: SymbolLayerSpecification = {
      id: cityNameLayerIds[game ? 'game' : 'big'][kind],
      type: 'symbol',
      source: cityNameSource,
      minzoom: cityNameMinZoom,
      filter: ['all', ['==', ['get', 'game'], game], ['==', ['get', 'capital'], kind === 'capital']],
      layout: {
        'text-field': ['get', 'name'],
        'text-max-width': cityNameMaxWidth,
        // The base style's city dot, a little bigger for a capital, until zoom 9.
        'icon-image': ['step', ['zoom'], 'circle_11_black', 9, ''],
        'icon-size': kind === 'capital' ? 0.5 : 0.4,
        'icon-allow-overlap': true,
        'icon-optional': false,
        ...(game ? {} : { 'symbol-sort-key': ['-', ['get', 'population']] }),
      },
    }
    const placed = cityNamePlacement(placeName(city, kind, theme))
    if (!game || placed.type !== 'symbol') return placed
    // Always below the dot, where cards are laid out around it, and written whatever else is there.
    return { ...placed, layout: { ...placed.layout, 'text-variable-anchor': ['top'], 'text-allow-overlap': true } }
  }
  return { big: [layer(false, 'city'), layer(false, 'capital')], game: [layer(true, 'city'), layer(true, 'capital')] }
}

/** Where a city's name goes around its dot. */
function cityNamePlacement(layer: LayerSpecification): LayerSpecification {
  if (layer.type !== 'symbol') return layer
  return {
    ...layer,
    layout: {
      ...layer.layout,
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
  /** How far apart its letters are spaced, in ems. */
  letterSpacing: number
  /** How far score cards keep clear of its letters, in pixels. */
  clearance: number
}

/**
 * How a city's name looks at a zoom level: a capital's or another city's, worked out from the same
 * theme the map draws it with.
 */
export function cityNameLook(zoom: number, capital: boolean, theme: Theme): CityNameLook {
  const kind = capital ? 'capital' : 'city'
  const size = atZoom(sizeStops(kind, theme), zoom)
  return {
    font: cssFont(theme.components.PlaceNames[kind].font, size),
    size,
    offset: (zoom < cardZoom ? cityNameOffset.small : cityNameOffset.card) * size,
    maxWidth: cityNameMaxWidth * size,
    letterSpacing: theme.components.PlaceNames[kind].letterSpacing,
    clearance: theme.components.ScoreCard.size.nameClearance,
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
  /** Names the cities for these games, the games shown (see cityLabels). */
  showGames(games: readonly Game[]): void
  /** Names the cities for the games shown by these settings from now on. */
  setSettings(settings: CityLabelSettings): void
  /**
   * Where the names of the games' cities are written on screen, for cards to keep clear of: those on
   * the side of the globe facing the viewer, as MapLibre writes no others.
   */
  nameBoxes(): ScreenBox[]
  remove(): void
}

/**
 * Keeps the city names on a map up to date with the games shown: the Big cities, and the cities
 * labelled for the games (see cityLabels) by `settings` until they're changed. The names' boxes are
 * worked out in the theme `theme` gives at the time.
 */
export function addPlaceNames(map: MapLibreMap, theme: () => Theme, settings: CityLabelSettings): PlaceNames {
  let venues: GlobePoint[] = []
  let labels: CityLabels = cityLabels(venues, cityList, settings)
  // The venues the labels were chosen for, so games changing only their scores change nothing.
  let venuesKey = ''

  const showLabels = () => map.getSource<GeoJSONSource>(cityNameSource)?.setData(cityNameFeatures(labels))
  // The style starts with no cities (see cityNameSourceSpec).
  map.on('style.load', showLabels)

  return {
    showGames(games) {
      const key = games.map(({ venue }) => `${venue.longitude},${venue.latitude}`).sort().join(';')
      if (key === venuesKey) return
      venuesKey = key
      venues = games.map((game) => game.venue)
      labels = cityLabels(venues, cityList, settings)
      showLabels()
    },
    setSettings(changed) {
      if (changed === settings) return
      settings = changed
      labels = cityLabels(venues, cityList, settings)
      showLabels()
    },
    nameBoxes() {
      const zoom = map.getZoom()
      if (zoom < cityNameMinZoom) return []
      return labels.gameCities
        .filter((city) => !isBehindGlobe(map, [city.longitude, city.latitude]))
        .map((city) =>
          cityNameBox(city.name, map.project([city.longitude, city.latitude]), cityNameLook(zoom, city.capital, theme()), measureText),
        )
    },
    remove() {
      map.off('style.load', showLabels)
    },
  }
}

/** The labelled cities as the city name source's features, marking the games' cities. */
export function cityNameFeatures({ gameCities, otherBigCities }: CityLabels): FeatureCollection<Point> {
  const feature = (city: ListedCity, game: boolean): Feature<Point> => ({
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [city.longitude, city.latitude] },
    properties: { name: city.name, capital: city.capital, population: city.population, game },
  })
  return {
    type: 'FeatureCollection',
    features: [...gameCities.map((city) => feature(city, true)), ...otherBigCities.map((city) => feature(city, false))],
  }
}

// Made when first needed, so the module loads where there's no page (in tests, say).
let measuring: CanvasRenderingContext2D | null | undefined

/**
 * A line's width in a CSS font of `size` pixels, in pixels (see MeasureText). The map writes its fonts
 * from its own glyphs, which the page doesn't have; the browser's fallback sans-serif measures a little
 * wider than Open Sans, which errs on the side of room. Kept once measured, as the same names are
 * measured every frame while the globe moves at one zoom.
 */
function measureText(text: string, font: string, size: number): number {
  const key = `${font}|${text}`
  const known = measured.get(key)
  if (known !== undefined) return known
  measuring ??= document.createElement('canvas').getContext('2d')
  if (!measuring) return text.length * fallbackLetterWidth * size
  measuring.font = font
  // Zooming measures each name at many sizes, so the oldest are let go.
  if (measured.size >= measuredKept) measured.clear()
  const width = measuring.measureText(text).width
  measured.set(key, width)
  return width
}
const measured = new Map<string, number>()
const measuredKept = 2000
// A letter's width in ems, roughly, where there's no canvas to measure with.
const fallbackLetterWidth = 0.6
