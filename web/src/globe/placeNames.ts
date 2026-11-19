import type {
  CircleLayerSpecification,
  DataDrivenPropertyValueSpecification,
  ExpressionSpecification,
  FilterSpecification,
  GeoJSONSource,
  GeoJSONSourceSpecification,
  LayerSpecification,
  Map as MapLibreMap,
  StyleSpecification,
  SymbolLayerSpecification,
} from 'maplibre-gl'
import type { Feature, FeatureCollection, Point } from 'geojson'
import type { PlacedGame } from '../games/placedGames'
import type { GlobeFont } from '../theme/globeFonts'
import { zoomStops, type Theme } from '../theme/theme'
import { cityLabels, cityList, type CityLabelSettings, type CityLabels, type ListedCity } from './cityLabels'
import { cityNameBox, type ScreenBox } from './cityNameBox'
import type { GlobePoint } from './geo'
import { fadedByHorizon, isBehindGlobe } from './horizon'
import { writtenNames, type NameOnScreen } from './writtenNames'
import stateNames from './stateNames.json'

// Place names of the base style the globe drops: its cities and capitals (city names are all the
// globe's own, from the city list: see cityNameLayers), towns, villages and other small places.
const droppedNames = new Set(['label_city', 'label_city_capital', 'label_town', 'label_village', 'label_other'])

/** The tiles' source layer of places: the base style's place names, such as states and countries. */
const placeTiles = 'place'

/** The source of the cities the globe names, from the city list (see cityLabels). */
export const cityNameSource = 'cityNames'

/** The city name source as the style starts it, empty until addPlaceNames fills it. */
export const cityNameSourceSpec: GeoJSONSourceSpecification = { type: 'geojson', data: { type: 'FeatureCollection', features: [] } }

/** The source of the US states' and Canadian provinces' and territories' abbreviations (see stateNameLayer). */
export const stateNameSource = 'stateNames'

/**
 * The state name source: the states, provinces and territories from stateNames.json (made by `npm run
 * state-names`), each with its postal code, at the point Natural Earth writes its name.
 */
export const stateNameSourceSpec: GeoJSONSourceSpecification = {
  type: 'geojson',
  data: {
    type: 'FeatureCollection',
    features: stateNames.map(({ name, postal, longitude, latitude }) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [longitude, latitude] },
      properties: { name, postal },
    })),
  },
}

/**
 * The globe's place names: the base style's states and countries, the US states' and Canadian
 * provinces' abbreviations zoomed out, and the city names from the city list (see cityNameLayers),
 * each in the theme's look for its kind of place, with the cities' dots beneath them all. MapLibre
 * places the top layer's names first, and each name after gives way to those placed before it: so the
 * games' cities come first, giving way only to each other, then countries, Big cities with no game
 * near, and states last, giving way to everything. Goes after the globe's lines.
 */
export function placeNameLayers(base: StyleSpecification, theme: Theme): LayerSpecification[] {
  const names = base.layers.filter((l) => l.type === 'symbol' && l['source-layer'] === placeTiles && !droppedNames.has(l.id))
  const isCountry = (l: LayerSpecification) => l.id.startsWith('label_country')
  const states = names.filter((l) => !isCountry(l)).map((l) => placeName(l, 'state', theme))
  const countries = names.filter(isCountry).map((l) => placeName(l, 'country', theme))
  const { dots, big, game } = cityNameLayers(theme)
  return [dots, stateNameLayer(theme), ...states, big, ...countries, game]
}

/**
 * The US states' and Canadian provinces' and territories' abbreviations, their postal codes (WA, ON),
 * zoomed out: from zoom 5 the base style writes their full names (label_state).
 */
function stateNameLayer(theme: Theme): LayerSpecification {
  const layer = placeName({ id: 'state_abbreviations', type: 'symbol', source: stateNameSource, maxzoom: 5 }, 'state', theme)
  return layer.type === 'symbol' ? { ...layer, layout: { ...layer.layout, 'text-field': ['get', 'postal'] } } : layer
}

/**
 * The globe's first place-name layer. Pins are added beneath it, so place names always draw over
 * them and stay readable.
 */
export function firstPlaceNameLayer(style: StyleSpecification): string | undefined {
  const placeSources = new Set([cityNameSource, stateNameSource])
  return style.layers.find((l) => l.type === 'symbol' && (placeSources.has(l.source) || l['source-layer'] === placeTiles))?.id
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
 * States and countries in capitals; city names as they are. Their colors, outlines, fonts, sizes and
 * letter spacing come from the theme.
 */
const capitals: ReadonlySet<PlaceKind> = new Set(['state', 'country'])

/**
 * A state's or country's name, once, in English: the base style writes it in its Latin spelling and
 * again in its own script (Russia, Mongolia, China). Where the tiles have no English name, its Latin
 * spelling, then its own name.
 */
export const englishName: ExpressionSpecification = ['coalesce', ['get', 'name:en'], ['get', 'name_en'], ['get', 'name:latin'], ['get', 'name']]

/** A kind of place's text sizes in the theme, as zoom, size stops (see zoomed), by zoom. */
const sizeStops = (kind: PlaceKind, theme: Theme): number[] => zoomStops(theme.components.PlaceNames[kind].size).flat()

/** A place name in the theme's look for its kind of place, in capitals or not (see capitals). */
function placeName(layer: LayerSpecification, kind: PlaceKind, theme: Theme): LayerSpecification {
  const look = theme.components.PlaceNames[kind]
  return {
    ...layer,
    layout: {
      ...(layer.type === 'symbol' ? layer.layout : {}),
      ...(kind === 'city' ? {} : { 'text-field': englishName }),
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

/** The city name layers' ids: Big cities with no game near, and the games' cities, and the cities' dots. */
const cityNameLayerIds = { big: 'city_names', game: 'city_names_game', dots: 'city_dots' } as const

/**
 * The layer naming the games' cities, the first place names placed: the cards', small pins' and card
 * clusters' footprints go just beneath it (see GameLayers), so other names give way to them, while
 * a game's city's name is written whatever cards and pins are there. Which games' cities' names are
 * written is the app's choice, not MapLibre's (see PlaceNames.layOutGameNames).
 */
export const gameCityNameLayer = cityNameLayerIds.game

/** Which city names each layer writes: Big cities' with no game near, and games' cities'. */
const cityNameFilters = {
  big: ['==', ['get', 'game'], false],
  game: ['all', ['==', ['get', 'game'], true], ['==', ['get', 'written'], true]],
} satisfies Record<'big' | 'game', FilterSpecification>

/** The feature state saying a city's name is written now, so its dot shows (see markNamedCities). */
const namedState = 'named'

/** The feature state saying a game's venue's pin or venue dot is on a city's dot, so it's hidden whole (see coverDots). */
const coveredState = 'covered'

/**
 * The layers naming the cities in the city name source (see addPlaceNames), at every zoom as score
 * cards show at every zoom, all in the theme's city look, national capitals included, and their dots.
 * Each name has one spot, right of its city's dot, and never moves from it. The games' cities' names
 * are placed first, and written whatever is there: the app leaves out the less populous of two that
 * overlap (see PlaceNames.layOutGameNames), and cards are laid out around the rest. Big cities with no
 * game near come after, written only where nothing placed before them is in their spot, giving way to
 * everything but states, most populous first. A city's dot shows while its name is written, and no
 * game's venue is near enough for its pin to touch it (see coverDots): a venue's pin comes first.
 */
function cityNameLayers(theme: Theme): { dots: LayerSpecification; big: LayerSpecification; game: LayerSpecification } {
  const layer = (kind: 'big' | 'game'): LayerSpecification => {
    const city: SymbolLayerSpecification = {
      id: cityNameLayerIds[kind],
      type: 'symbol',
      source: cityNameSource,
      filter: cityNameFilters[kind],
      layout: {
        'text-field': ['get', 'name'],
        'text-max-width': cityNameMaxWidth,
        'text-anchor': 'left',
        'text-justify': 'left',
        'text-offset': [cityNameOffset, 0],
        'symbol-sort-key': ['-', ['get', 'population']],
      },
    }
    if (kind === 'game') city.layout = { ...city.layout, 'text-allow-overlap': true }
    const named = placeName(city, 'city', theme)
    // Faded out near the horizon (see fadeNearHorizon), where they'd crowd into a pile: all but a
    // game's city (see PlaceNames.namesAGame).
    if (named.type === 'symbol') named.paint = { ...named.paint, 'text-opacity': fadedByHorizon() }
    return named
  }
  const look = theme.components.PlaceNames.city
  const shown = fadedByHorizon([
    'case',
    ['all', ['boolean', ['feature-state', namedState], false], ['!', ['boolean', ['feature-state', coveredState], false]]],
    1,
    0,
  ])
  const dots: CircleLayerSpecification = {
    id: cityNameLayerIds.dots,
    type: 'circle',
    source: cityNameSource,
    paint: {
      'circle-radius': look.dot.radius,
      'circle-color': look.color,
      'circle-stroke-width': look.dot.ring,
      'circle-stroke-color': look.outline.color,
      'circle-opacity': shown,
      'circle-stroke-opacity': shown,
    },
  }
  return { dots, big: layer('big'), game: layer('game') }
}

// How far a city's name sits right of its dot, in ems: clear of the dot and its ring.
const cityNameOffset = 0.5

/** Where and how big a city's name is written right of its dot, so cards can keep clear of it. */
export interface CityNameLook {
  /** The font, as a CSS font for measuring the name. */
  font: string
  /** The text's size in pixels. */
  size: number
  /** How far the name's left edge sits right of the city's dot, in pixels. */
  offset: number
  /** The widest a line gets before the name wraps, in pixels. */
  maxWidth: number
  /** How far apart its letters are spaced, in ems. */
  letterSpacing: number
  /** How far score cards keep clear of its letters, in pixels. */
  clearance: number
}

/** How a city's name looks at a zoom level, worked out from the same theme the map draws it with. */
export function cityNameLook(zoom: number, theme: Theme): CityNameLook {
  const look = theme.components.PlaceNames.city
  const size = atZoom(sizeStops('city', theme), zoom)
  return {
    font: cssFont(look.font, size),
    size,
    offset: cityNameOffset * size,
    maxWidth: cityNameMaxWidth * size,
    letterSpacing: look.letterSpacing,
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
  showGames(games: readonly PlacedGame[]): void
  /** Names the cities for the games shown by these settings from now on. */
  setSettings(settings: CityLabelSettings): void
  /**
   * Whether the city name source's feature with this id is a game's city: every game on screen has a
   * score card (or is in a card cluster, or shows as its small pin), and its city's name is always
   * written with it, so the name doesn't fade near the horizon.
   */
  namesAGame(id: string | number): boolean
  /**
   * Picks which games' cities' names to write where the globe is now, and gives where they're written
   * on screen, for cards to keep clear of: those on the side of the globe facing the viewer, as
   * MapLibre writes no others. Of two names that overlap, the more populous city's is written, each
   * sticky by a few pixels (see writtenNames), so a pan never flips one.
   */
  layOutGameNames(): ScreenBox[]
  remove(): void
}

/**
 * Keeps the city names on a map up to date with the games shown: the Big cities, and the cities
 * labeled for the games (see cityLabels) by `settings` until they're changed, each city's dot showing
 * while its name is written (see markNamedCities). The names' boxes are worked out in the theme
 * `theme` gives at the time.
 */
export function addPlaceNames(map: MapLibreMap, theme: () => Theme, settings: CityLabelSettings): PlaceNames {
  let venues: GlobePoint[] = []
  let labels: CityLabels
  const relabel = () => (labels = cityLabels(venues, cityList, settings))
  relabel()
  // The venues the labels were chosen for, so games changing only their scores change nothing.
  let venuesKey = ''

  // Whether each game's city's name was written when last laid out, by its key (see nameKey).
  let written = new Map<string, boolean>()
  const dots = markNamedCities(map)
  const covers = coverDots(map)
  const showLabels = () => {
    map.getSource<GeoJSONSource>(cityNameSource)?.setData(cityNameFeatures(labels, (city) => written.get(nameKey(city)) !== false))
    dots.renumbered()
    covers.renumbered()
  }
  // The style starts with no cities (see cityNameSourceSpec).
  const styleLoaded = () => showLabels()
  map.on('style.load', styleLoaded)

  return {
    showGames(games) {
      const key = games.map(({ venue }) => `${venue.longitude},${venue.latitude}`).sort().join(';')
      if (key === venuesKey) return
      venuesKey = key
      venues = games.map((game) => game.venue)
      relabel()
      showLabels()
    },
    setSettings(changed) {
      if (changed === settings) return
      settings = changed
      relabel()
      showLabels()
    },
    namesAGame(id) {
      return typeof id === 'number' && id < labels.gameCities.length
    },
    layOutGameNames() {
      const look = cityNameLook(map.getZoom(), theme())
      const onScreen = labels.gameCities
        .filter((city) => !isBehindGlobe(map, [city.longitude, city.latitude]))
        .map((city) => ({ city, dot: map.project([city.longitude, city.latitude]) }))
      // Names keep clear of each other by their letters, cards by the theme's clearance around them too.
      const names = onScreen.map(({ city, dot }): NameOnScreen => ({
        key: nameKey(city),
        population: city.population,
        box: cityNameBox(city.name, dot, { ...look, clearance: 0 }, measureText),
      }))
      const now = new Map([...written, ...writtenNames(names, written, nameStickiness)])
      const changed = [...now].some(([key, shown]) => written.get(key) !== shown)
      written = now
      if (changed) showLabels()
      // After any relabeling, which numbers the cities afresh.
      covers.cover([...labels.gameCities, ...labels.otherBigCities], venues, theme())
      return onScreen.filter(({ city }) => now.get(nameKey(city))).map(({ city, dot }) => cityNameBox(city.name, dot, look, measureText))
    },
    remove() {
      map.off('style.load', styleLoaded)
      dots.remove()
    },
  }
}

/**
 * Shows each city's dot while its name is written: MapLibre writes a name only where it has room,
 * which changes as the globe moves, so the names written are read back from the map, at most every
 * markEvery while it draws and once it's still, and marked on their features (see namedState).
 */
function markNamedCities(map: MapLibreMap): { renumbered(): void; remove(): void } {
  let named = new Set<string | number>()
  const mark = (id: string | number, on: boolean) => map.setFeatureState({ source: cityNameSource, id }, { [namedState]: on })
  const markNow = () => {
    if (!map.getLayer(gameCityNameLayer)) return
    const layers = [cityNameLayerIds.game, cityNameLayerIds.big]
    const now = new Set(map.queryRenderedFeatures({ layers }).flatMap(({ id }) => (id === undefined ? [] : [id])))
    for (const id of named) if (!now.has(id)) mark(id, false)
    for (const id of now) if (!named.has(id)) mark(id, true)
    named = now
  }
  let markedAt = -Infinity
  const drawn = () => {
    const now = performance.now()
    if (now - markedAt < markEvery) return
    markedAt = now
    markNow()
  }
  map.on('render', drawn)
  map.on('idle', markNow)
  return {
    // The cities given afresh, numbered afresh: no dot stays on for the city its id named before.
    renumbered() {
      for (const id of named) mark(id, false)
      named = new Set()
    },
    remove() {
      map.off('render', drawn)
      map.off('idle', markNow)
    },
  }
}

/**
 * Hides a city's dot whole while a game's venue on screen is near enough for its small pin or venue
 * dot to touch it, so a dot never peeks out beside a pin, which comes first. Each city is marked on
 * its feature by its id (see cityNameFeatures), as they're given to cover.
 */
function coverDots(map: MapLibreMap): { cover(cities: readonly ListedCity[], venues: readonly GlobePoint[], theme: Theme): void; renumbered(): void } {
  let covered = new Set<number>()
  const mark = (id: number, on: boolean) => map.setFeatureState({ source: cityNameSource, id }, { [coveredState]: on })
  return {
    cover(cities, venues, theme) {
      const dot = theme.components.PlaceNames.city.dot
      const reach = venueMarkerReach(theme) + dot.radius + dot.ring
      const onScreen = venues
        .filter((venue) => !isBehindGlobe(map, [venue.longitude, venue.latitude]))
        .map((venue) => map.project([venue.longitude, venue.latitude]))
      const now = new Set<number>()
      cities.forEach((city, id) => {
        if (isBehindGlobe(map, [city.longitude, city.latitude])) return
        const at = map.project([city.longitude, city.latitude])
        if (onScreen.some((venue) => Math.hypot(venue.x - at.x, venue.y - at.y) < reach)) now.add(id)
      })
      for (const id of covered) if (!now.has(id)) mark(id, false)
      for (const id of now) if (!covered.has(id)) mark(id, true)
      covered = now
    },
    renumbered() {
      for (const id of covered) mark(id, false)
      covered = new Set()
    },
  }
}

/** How far a game's marker at its venue reaches on screen, in pixels: the largest small pin's core and ring, or a score card's venue dot's ring. */
function venueMarkerReach(theme: Theme): number {
  const { Pin, Trail } = theme.components
  const pins = [Pin.live, Pin.upcoming, Pin.final].map(({ core }) => core.radius + core.ring)
  return Math.max(...pins, Trail.venue.ring.radius + Trail.venue.ring.width / 2)
}

/** A city, the same from frame to frame whatever else is named, for remembering whether its name was written. */
const nameKey = (city: ListedCity) => `${city.name}@${city.longitude},${city.latitude}`

// How far, in pixels, two games' cities' names overlap before the less populous gives way, and clear
// each other before it comes back (see writtenNames).
const nameStickiness = 4

// How often, in milliseconds, the dots follow the names written while the globe moves.
const markEvery = 100

/**
 * The labeled cities as the city name source's features, marking the games' cities, and which of
 * those have their names written (see PlaceNames.layOutGameNames): all of them unless `written` says.
 */
export function cityNameFeatures({ gameCities, otherBigCities }: CityLabels, written: (city: ListedCity) => boolean = () => true): FeatureCollection<Point> {
  // Each with an id, for fading it near the horizon (see fadeNearHorizon) and showing its dot (see markNamedCities).
  const feature = (city: ListedCity, game: boolean, id: number): Feature<Point> => ({
    type: 'Feature',
    id,
    geometry: { type: 'Point', coordinates: [city.longitude, city.latitude] },
    properties: { name: city.name, population: city.population, game, written: game && written(city) },
  })
  return {
    type: 'FeatureCollection',
    features: [...gameCities.map((city) => ({ city, game: true })), ...otherBigCities.map((city) => ({ city, game: false }))].map(
      ({ city, game }, id) => feature(city, game, id),
    ),
  }
}

// Made when first needed, so the module loads where there's no page (in tests, say).
let measuring: CanvasRenderingContext2D | null | undefined

/**
 * A line's width in a CSS font of `size` pixels, in pixels (see MeasureText). The map writes its fonts
 * from its own glyphs, which the page doesn't have; the browser's fallback sans-serif measures a little
 * wider than Open Sans, which errs on the side of room. A line is as wide as its font is big, so it's
 * measured at one size and kept, as the same names are measured every frame while the globe moves:
 * on the globe the zoom, and so the size, shifts a little with every move.
 */
function measureText(text: string, font: string, size: number): number {
  // The font at the size measured at (see cssFont).
  const measuredFont = font.replace(`${size}px`, `${measuredSize}px`)
  const key = `${measuredFont}|${text}`
  const known = measured.get(key)
  if (known !== undefined) return (known * size) / measuredSize
  measuring ??= typeof document === 'undefined' ? null : document.createElement('canvas').getContext('2d')
  if (!measuring) return text.length * fallbackLetterWidth * size
  measuring.font = measuredFont
  // Many names in many fonts (themes changing, say): the oldest are let go.
  if (measured.size >= measuredKept) measured.clear()
  const width = measuring.measureText(text).width
  measured.set(key, width)
  return (width * size) / measuredSize
}
const measured = new Map<string, number>()
const measuredKept = 2000
// The size, in pixels, names are measured at.
const measuredSize = 100
// A letter's width in ems, roughly, where there's no canvas to measure with.
const fallbackLetterWidth = 0.6
