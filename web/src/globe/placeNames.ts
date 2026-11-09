import type {
  DataDrivenPropertyValueSpecification,
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
import { kmApart, type GlobePoint } from './geo'
import { fadedByHorizon, isBehindGlobe } from './horizon'
import { widestClusterReach } from './pinLayers'
import { cardZoom, hasCard } from './zoomLevels'

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

/** The city name layers' ids: Big cities with no game near, and the games' cities. */
const cityNameLayerIds = { big: 'city_names', game: 'city_names_game', card: 'city_names_card' } as const

/**
 * The layer naming the cities of games with a score card on screen, the last place names placed: the
 * cards' and small pins' footprints go just beneath it (see GameLayers).
 */
export const gameCityNameLayer = cityNameLayerIds.card

/** Which city names each layer writes: Big cities', other games' cities', and score cards' cities'. */
const cityNameFilters = {
  big: ['==', ['get', 'game'], false],
  game: ['all', ['==', ['get', 'game'], true], ['!=', ['get', 'card'], true]],
  card: ['all', ['==', ['get', 'game'], true], ['==', ['get', 'card'], true]],
} satisfies Record<keyof typeof cityNameLayerIds, FilterSpecification>

/**
 * The layers naming the cities in the city name source (see addPlaceNames), from the card zoom (a
 * laptop's in the style, switched by addPlaceNames as score cards show: see cityNamesFrom), with the score cards, all in the
 * theme's city look, national capitals included, with no dot: just the name, around where the city is, and
 * where it has room (see cityNamePositions). The city of a game whose score card is on screen (see
 * PlaceNames.showCards) is always written, below where it is unless a cluster is there (see
 * GameLayers), and cards are laid out around it. Other games' cities come next, giving way to
 * clusters, cards and those names; then Big cities with no game near, most populous first, giving
 * way to everything else.
 */
function cityNameLayers(theme: Theme): { big: LayerSpecification[]; game: LayerSpecification[] } {
  const layer = (kind: keyof typeof cityNameLayerIds): LayerSpecification => {
    const city: SymbolLayerSpecification = {
      id: cityNameLayerIds[kind],
      type: 'symbol',
      source: cityNameSource,
      minzoom: cardZoom,
      filter: cityNameFilters[kind],
      layout: {
        'text-field': ['get', 'name'],
        'text-max-width': cityNameMaxWidth,
        ...(kind === 'big' ? { 'symbol-sort-key': ['-', ['get', 'population']] } : {}),
      },
    }
    const named = placeName(city, 'city', theme)
    // Faded out near the horizon (see fadeNearHorizon), where they'd crowd into a pile: all but a
    // game's city naming a game with a score card (see PlaceNames.namesACard).
    if (named.type === 'symbol') named.paint = { ...named.paint, 'text-opacity': fadedByHorizon() }
    const placed = cityNamePlacement(named, theme)
    if (kind !== 'card' || placed.type !== 'symbol') return placed
    // Always written, as its card is: below the dot, where the cards are laid out around it, unless a
    // cluster's there (or another card's city's name), then on another side that's free, or further
    // out clear of the cluster; below it after all if none is. Cards' and small pins' footprints are
    // placed after these names, so they never move them.
    return { ...placed, layout: { ...placed.layout, 'text-allow-overlap': true } }
  }
  return { big: [layer('big')], game: [layer('game'), layer('card')] }
}

/** Where a city's name goes around its dot (see cityNamePositions). */
function cityNamePlacement(layer: LayerSpecification, theme: Theme): LayerSpecification {
  if (layer.type !== 'symbol') return layer
  return { ...layer, layout: { ...layer.layout, 'text-variable-anchor-offset': cityNamePositions(theme) } }
}

/** The sides of its dot a city's name may go, in the order tried: below, above, left of it, right of it. */
const cityNameSides = [
  ['top', [0, 1]],
  ['bottom', [0, -1]],
  ['left', [1, 0]],
  ['right', [-1, 0]],
] as const

/**
 * Where a city's name may go around its dot, as MapLibre's anchors and offsets (in ems), in the order
 * tried: below the dot by preference, clear of its own game's score card above the venue; if a card or
 * cluster covers that spot (see cardLayoutLayers' cardFootprint and pinLayers' clusterFootprintLayout),
 * another side; and if a cluster sits on the dot itself, covering every near side, each side again
 * further out, clear of the widest cluster at the smallest size names are written in (see
 * clusterClearOffset).
 */
export function cityNamePositions(theme: Theme): ['literal', (string | number[])[]] {
  const far = clusterClearOffset(theme)
  const at = (offset: number) =>
    cityNameSides.flatMap(([anchor, [x, y]]) => [anchor, [x * offset, y * offset]])
  return ['literal', [...at(cityNameOffset), ...at(far)]]
}

/**
 * How far a city's name sits from its dot, in ems, to clear a cluster on it: as far as the widest
 * cluster reaches, outline and all, past its footprint's pixel, with room for the name's outline, at
 * the smallest size city names are written in.
 */
export function clusterClearOffset(theme: Theme): number {
  const smallest = Math.min(...zoomStops(theme.components.PlaceNames.city.size).map(([, size]) => size))
  const clear = widestClusterReach(theme) + 1 + theme.components.PlaceNames.city.outline.width
  return Math.ceil((clear / smallest) * 100) / 100
}

// How far a city's name sits from its dot, in ems: clear of a score card's trail. City names show
// only from the card zoom, where pins are score cards.
const cityNameOffset = 1

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
  /** Names cities from this zoom on, the zoom score cards show from (see FittedZoom). */
  showFrom(zoom: number): void
  /**
   * Whether the city name source's feature with this id is a game's city with a game in reach that
   * has a score card, looking at `centre` (see hasCard): a card is always shown with its city's name,
   * so the name doesn't fade near the horizon while the card shows.
   */
  namesACard(id: string | number, centre: GlobePoint): boolean
  /**
   * Always writes the names of the games' cities with a score card on screen, at these venues; the
   * other games' cities give way where there's no room, to clusters and other names (see
   * cityNameLayers).
   */
  showCards(venues: readonly GlobePoint[]): void
  /**
   * Where the names of the games' cities are written on screen, for cards to keep clear of: those on
   * the side of the globe facing the viewer, as MapLibre writes no others.
   */
  nameBoxes(): ScreenBox[]
  remove(): void
}

/**
 * Keeps the city names on a map up to date with the games shown: the Big cities, and the cities
 * labelled for the games (see cityLabels) by `settings` until they're changed, from the zoom `from`
 * until that's changed. The names' boxes are worked out in the theme `theme` gives at the time.
 */
export function addPlaceNames(map: MapLibreMap, theme: () => Theme, settings: CityLabelSettings, from = cardZoom): PlaceNames {
  let venues: GlobePoint[] = []
  let labels: CityLabels
  // The venues in reach of each game's city, by its feature's id (see cityNameFeatures).
  let namedVenues: GlobePoint[][] = []
  const relabel = () => {
    labels = cityLabels(venues, cityList, settings)
    namedVenues = labels.gameCities.map((city) => venues.filter((venue) => kmApart(venue, city) <= settings.gameCityKm))
  }
  relabel()
  // The venues the labels were chosen for, so games changing only their scores change nothing.
  let venuesKey = ''
  // The venues of the cards on screen, and the ids of the games' cities naming them.
  let cardVenues: readonly GlobePoint[] = []
  let carded = new Set<number>()
  const cardedNow = () =>
    new Set(
      namedVenues.flatMap((named, id) => (named.some((venue) => cardVenues.some((card) => kmApart(venue, card) < sameVenueKm)) ? [id] : [])),
    )

  const showLabels = () => {
    carded = cardedNow()
    map.getSource<GeoJSONSource>(cityNameSource)?.setData(cityNameFeatures(labels, carded))
  }
  // The style names cities from a laptop's card zoom.
  const showFromZoom = () => {
    for (const id of Object.values(cityNameLayerIds)) if (map.getLayer(id)) map.setLayerZoomRange(id, from, 24)
  }
  // The style starts with no cities (see cityNameSourceSpec).
  const styleLoaded = () => {
    showLabels()
    showFromZoom()
  }
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
    showCards(venues) {
      cardVenues = venues
      const now = cardedNow()
      if (now.size === carded.size && [...now].every((id) => carded.has(id))) return
      showLabels()
    },
    namesACard(id, centre) {
      return typeof id === 'number' && (namedVenues[id]?.some((venue) => hasCard(centre, venue)) ?? false)
    },
    showFrom(zoom) {
      from = zoom
      showFromZoom()
    },
    nameBoxes() {
      const zoom = map.getZoom()
      // As MapLibre does, a minimum of 0 is none: its zoom goes below 0 near the poles.
      if (from > 0 && zoom < from) return []
      const look = cityNameLook(zoom, theme())
      return labels.gameCities
        .filter((city) => !isBehindGlobe(map, [city.longitude, city.latitude]))
        .map((city) => cityNameBox(city.name, map.project([city.longitude, city.latitude]), look, measureText))
    },
    remove() {
      map.off('style.load', styleLoaded)
    },
  }
}

// How close a card's venue is to a game's venue to be the same, in kilometres.
const sameVenueKm = 0.01

/**
 * The labelled cities as the city name source's features, marking the games' cities, and those with
 * these ids (see showCards) as naming a score card on screen.
 */
export function cityNameFeatures({ gameCities, otherBigCities }: CityLabels, carded: ReadonlySet<number> = new Set()): FeatureCollection<Point> {
  // Each with an id, for fading it near the horizon (see fadeNearHorizon).
  const feature = (city: ListedCity, game: boolean, id: number): Feature<Point> => ({
    type: 'Feature',
    id,
    geometry: { type: 'Point', coordinates: [city.longitude, city.latitude] },
    properties: { name: city.name, population: city.population, game, card: carded.has(id) },
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
  measuring ??= document.createElement('canvas').getContext('2d')
  if (!measuring) return text.length * fallbackLetterWidth * size
  measuring.font = measuredFont
  // Many names in many fonts (the theme tuner's, say): the oldest are let go.
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
