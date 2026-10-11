import type { LayerSpecification, LineLayerSpecification, StyleSpecification } from 'maplibre-gl'
import { glyphsUrl } from '../theme/globeFonts'
import { zoomStops, type Theme } from '../theme/theme'
import { placeNameLayers, placeNameState } from './placeNames'

/** Free vector tiles with borders and place labels (ADR-0004). The globe keeps its data, not its look. */
export const baseStyleUrl = 'https://tiles.openfreemap.org/styles/liberty'

// Layers of the base style that the globe keeps.
const countryLines = 'boundary_2'
const stateLines = 'boundary_3'
const disputedLines = 'boundary_disputed'

/**
 * The globe's look, made from the base style in the theme's colours: a plain globe where only thin
 * lines show coastlines, country borders and state lines, with place names (see placeNames). Land
 * and sea are the same colour, the theme's globe surface. Everything else in the base style (roads,
 * buildings, land cover) is dropped.
 */
export function globeStyle(base: StyleSpecification, theme: Theme): StyleSpecification {
  const { globe } = theme
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
      { id: 'background', type: 'background', paint: { 'background-color': globe.surface } },
      // Coastlines: the edges of the sea, which is the same colour as the land. Lakes and rivers
      // aren't outlined; at a distance they read as clutter.
      {
        id: 'coastline',
        type: 'line',
        source: 'openmaptiles',
        'source-layer': 'water',
        filter: ['==', ['get', 'class'], 'ocean'],
        paint: linePaint(globe.coastlines),
      },
      // The base style hides state and province lines below zoom 5; the tiles carry them from zoom 1.
      restyled(stateLines, { minzoom: 0, paint: linePaint(globe.stateLines) }),
      restyled(countryLines, { paint: linePaint(globe.countryBorders) }),
      restyled(disputedLines, { paint: { ...linePaint(globe.disputedBorders), 'line-dasharray': [...globe.disputedBorders.dash] } }),
      ...placeNameLayers(base, theme),
    ],
  }
}

type GlobeLine = Theme['globe']['coastlines']

/** A line in the theme's colour, at its widths as the map zooms, growing evenly from one to the next. */
function linePaint({ color, width }: GlobeLine): LineLayerSpecification['paint'] {
  const stops = zoomStops(width)
  return {
    'line-color': color,
    'line-width': stops.length === 1 ? stops[0][1] : ['interpolate', ['linear'], ['zoom'], ...stops.flat()],
  }
}
