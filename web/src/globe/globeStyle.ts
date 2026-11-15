import type {
  GeoJSONSource,
  GeoJSONSourceSpecification,
  Map as MapLibreMap,
  LayerSpecification,
  LineLayerSpecification,
  RasterSourceSpecification,
  StyleSpecification,
} from 'maplibre-gl'
import type { MapType } from '../settings/viewerSettings'
import { glyphsUrl } from '../theme/globeFonts'
import { zoomStops, type Theme } from '../theme/theme'
import { cityNameSource, cityNameSourceSpec, placeNameLayers } from './placeNames'
import stateLinesUrl from './stateLines.json?url'

/** Free vector tiles with borders and place labels (ADR-0004). The globe keeps its data, not its look. */
export const baseStyleUrl = 'https://tiles.openfreemap.org/styles/liberty'

// Layers of the base style that the globe keeps.
const countryLines = 'boundary_2'
const disputedLines = 'boundary_disputed'

/**
 * State and province lines: the United States' and Canada's only, at every zoom (ADR-0026). The map's
 * own tiles carry every country's, with nothing saying whose, and none at all in their coarsest tiles
 * (zoom 0), which the globe shows zoomed all the way out and toward its edges. These are Natural
 * Earth's, made by `npm run state-lines` (scripts/stateLines.ts), a file of their own rather than
 * built into the page, and fetched only once the globe is ready (see showStateLines), so they never
 * hold up the first view.
 */
export const stateLinesSource = 'state-lines'
export const stateLinesLayer = 'state-lines'
export const satelliteStateLinesLayer = 'state-lines-satellite'

const stateLinesSourceSpec: GeoJSONSourceSpecification = { type: 'geojson', data: { type: 'FeatureCollection', features: [] } }

/** Fetches the state lines into the globe's style, which starts with none (see stateLinesSource). */
export function showStateLines(map: Pick<MapLibreMap, 'getSource'>): void {
  map.getSource<GeoJSONSource>(stateLinesSource)?.setData(stateLinesUrl)
}

/** The satellite map's imagery: EOX's cloudless Sentinel-2 mosaic of 2024, free for non-commercial use with its credit shown (ADR-0022). */
export const satelliteSource = 'satellite'
export const satelliteLayer = 'satellite'

const satelliteTiles = 'https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2024_3857/default/g/{z}/{y}/{x}.jpg'

/** One tile of the satellite map's imagery, the address of its picture: Map Type shows one (see MapTypes). */
export function satelliteTile(z: number, y: number, x: number): string {
  return satelliteTiles.replace('{z}', String(z)).replace('{y}', String(y)).replace('{x}', String(x))
}

const satelliteSourceSpec: RasterSourceSpecification = {
  type: 'raster',
  tiles: [satelliteTiles],
  tileSize: 256,
  // EOX's tiles go to zoom 21, but the imagery's 10 m pixels are as sharp as it gets by about 14.
  maxzoom: 14,
}

/**
 * The globe's look, made from the base style in the theme's colors. On the plain map, a plain globe:
 * land in the theme's globe surface, the sea (oceans and lakes) in its sea color, and lines showing
 * coastlines, country borders and state lines, with place names (see placeNames). On the satellite map,
 * satellite imagery under the same borders, state lines and names, with no sea or coastlines, which
 * the imagery shows. Everything else in the base style (roads, buildings, land cover) is dropped.
 *
 * Both map types' layers are always in the style, those of the other type hidden, so switching
 * between them is a restyle like a theme's (see layerChanges). MapLibre loads no tiles for a source
 * whose layers are all hidden, so the plain map fetches no imagery.
 */
export function globeStyle(base: StyleSpecification, theme: Theme, mapType: MapType = 'plain'): StyleSpecification {
  const globe = theme.components.Globe
  const byId = new Map(base.layers.map((layer) => [layer.id, layer]))
  const layer = (id: string) => {
    const found = byId.get(id)
    if (!found) throw new Error(`The base map style has no layer "${id}"`)
    return found
  }
  const restyled = (id: string, changes: Partial<LayerSpecification>): LayerSpecification =>
    ({ ...layer(id), ...changes }) as LayerSpecification
  const shownOn = (type: MapType) => (type === mapType ? 'visible' : 'none')
  const stateLinePaint = linePaint(globe.stateLines)

  return {
    ...base,
    glyphs: glyphsUrl,
    // MapLibre's own atmosphere is lit from one side; the globe gets an even halo instead (globeGlow.ts).
    sky: { 'atmosphere-blend': 0 },
    sources: {
      ...base.sources,
      [satelliteSource]: satelliteSourceSpec,
      [stateLinesSource]: stateLinesSourceSpec,
      [cityNameSource]: cityNameSourceSpec,
    },
    layers: [
      { id: 'background', type: 'background', paint: { 'background-color': globe.surface } },
      // The globe's own state lines (see stateLinesSource), in place of the base style's (boundary_3).
      // On the plain map under the sea, which hides where they run over water (Natural Earth's go out
      // across bays and lakes); on the satellite map over its imagery.
      { id: stateLinesLayer, type: 'line', source: stateLinesSource, layout: { visibility: shownOn('plain') }, paint: stateLinePaint },
      // The sea, oceans and lakes alike, so the land stands apart from it.
      {
        id: 'sea',
        type: 'fill',
        source: 'openmaptiles',
        'source-layer': 'water',
        filter: ['in', ['get', 'class'], ['literal', ['ocean', 'lake']]],
        layout: { visibility: shownOn('plain') },
        paint: { 'fill-color': globe.sea, 'fill-antialias': false },
      },
      { id: satelliteLayer, type: 'raster', source: satelliteSource, layout: { visibility: shownOn('satellite') } },
      {
        id: satelliteStateLinesLayer,
        type: 'line',
        source: stateLinesSource,
        layout: { visibility: shownOn('satellite') },
        paint: stateLinePaint,
      },
      // Coastlines: the edges of the sea. Lakes and rivers aren't outlined; at a distance they read
      // as clutter.
      {
        id: 'coastline',
        type: 'line',
        source: 'openmaptiles',
        'source-layer': 'water',
        filter: ['==', ['get', 'class'], 'ocean'],
        layout: { visibility: shownOn('plain') },
        paint: linePaint(globe.coastlines),
      },
      restyled(countryLines, { paint: linePaint(globe.countryBorders) }),
      restyled(disputedLines, { paint: { ...linePaint(globe.disputedBorders), 'line-dasharray': [...globe.disputedBorders.dash] } }),
      ...placeNameLayers(base, theme),
    ],
  }
}

type GlobeLine = Theme['components']['Globe']['coastlines']

/** A line in the theme's color, at its widths as the map zooms, growing evenly from one to the next. */
function linePaint({ color, width }: GlobeLine): LineLayerSpecification['paint'] {
  const stops = zoomStops(width)
  return {
    'line-color': color,
    'line-width': stops.length === 1 ? stops[0][1] : ['interpolate', ['linear'], ['zoom'], ...stops.flat()],
  }
}
