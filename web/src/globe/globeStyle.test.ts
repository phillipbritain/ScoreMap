import {
  createExpression,
  featureFilter,
  type ExpressionSpecification,
  type FilterSpecification,
} from '@maplibre/maplibre-gl-style-spec'
import type { StyleSpecification } from 'maplibre-gl'
import { describe, expect, it, vi } from 'vitest'
import { builtInTheme } from '../theme/builtInTheme'
import { globeFonts, glyphsUrl } from '../theme/globeFonts'
import type { Theme } from '../theme/theme'
import { globeStyle, showStateLines } from './globeStyle'
import { layerChanges } from './restyle'
import type { ListedCity } from './cityLabels'
import { cityNameFeatures, cityNameSource, firstPlaceNameLayer, stateNameSource } from './placeNames'

function base(layers: StyleSpecification['layers']): StyleSpecification {
  return { version: 8, sources: { openmaptiles: { type: 'vector', url: 'https://example.test' } }, layers }
}

const tiles = { source: 'openmaptiles' } as const
const liberty = base([
  { id: 'background', type: 'background', paint: { 'background-color': '#f8f4f0' } },
  { id: 'water', type: 'fill', ...tiles, 'source-layer': 'water' },
  { id: 'road_major', type: 'line', ...tiles, 'source-layer': 'transportation' },
  { id: 'boundary_3', type: 'line', ...tiles, 'source-layer': 'boundary', minzoom: 5 },
  { id: 'boundary_2', type: 'line', ...tiles, 'source-layer': 'boundary' },
  { id: 'boundary_disputed', type: 'line', ...tiles, 'source-layer': 'boundary' },
  { id: 'poi', type: 'symbol', ...tiles, 'source-layer': 'poi' },
  { id: 'label_village', type: 'symbol', ...tiles, 'source-layer': 'place' },
  {
    id: 'label_city',
    type: 'symbol',
    ...tiles,
    'source-layer': 'place',
    filter: ['==', ['get', 'class'], 'city'],
    layout: { 'text-anchor': 'bottom', 'text-offset': [0, -0.1] },
  },
  { id: 'label_state', type: 'symbol', ...tiles, 'source-layer': 'place', minzoom: 5, maxzoom: 8 },
  { id: 'label_town', type: 'symbol', ...tiles, 'source-layer': 'place', filter: ['==', ['get', 'class'], 'town'] },
  { id: 'label_city_capital', type: 'symbol', ...tiles, 'source-layer': 'place', filter: ['==', ['get', 'capital'], 2] },
  { id: 'label_country_1', type: 'symbol', ...tiles, 'source-layer': 'place' },
])

const font = (name: string) => globeFonts.get(name)!

/** A theme with a color and font of its own for everything the globe draws, to tell them apart. */
const theme: Theme = {
  ...builtInTheme,
  components: {
    ...builtInTheme.components,
    Globe: {
      surface: '#000001',
      sea: '#000006',
      coastlines: { color: '#000002', width: { '1': 0.5, '9': 2 } },
      countryBorders: { color: '#000003', width: { '2': 0.7, '6': 1.5 } },
      stateLines: { color: '#000004', width: { '4': 0.4, '7': 1.1 } },
      disputedBorders: { color: '#000005', width: { '0': 0.9 }, dash: [3, 1] },
      halo: builtInTheme.components.Globe.halo,
    },
    PlaceNames: {
      city: {
        ...builtInTheme.components.PlaceNames.city,
        color: '#100001',
        outline: outline('#200001', 2.5, 0.25),
        font: font('Open Sans Light'),
        letterSpacing: 0.03,
        dot: { radius: 1.75, ring: 0.5 },
      },
      state: { ...builtInTheme.components.PlaceNames.state, color: '#100003', outline: outline('#200003', 1.5, 0), font: font('Metropolis Regular'), letterSpacing: 0.3 },
      country: { ...builtInTheme.components.PlaceNames.country, color: '#100004', outline: outline('#200004', 1, 1), font: font('Klokantech Noto Sans Bold'), letterSpacing: 0.2 },
    },
  },
}

function outline(color: string, width: number, blur: number) {
  return { color, width, blur }
}

const style = (base: StyleSpecification = liberty) => globeStyle(base, theme)
const layer = (id: string) => style().layers.find((l) => l.id === id)
const paint = (id: string) => layer(id)?.paint as Record<string, unknown>
const layout = (id: string) => layer(id)?.layout as Record<string, unknown>

/** What a zoom-dependent paint value is at a zoom level, as MapLibre works it out. */
function atZoom(value: unknown, zoom: number): number {
  const parsed = createExpression(value as ExpressionSpecification, 'test')
  if (parsed.result !== 'success') throw new Error(parsed.value.map((e) => e.message).join('; '))
  return parsed.value.evaluate({ zoom }) as number
}

describe('globeStyle', () => {
  it("keeps only the lines and state and country names, dropping roads, land cover, points of interest and the base style's cities, towns and villages for its own city names", () => {
    expect(style().layers.map((l) => l.id)).toEqual([
      'background',
      'state-lines',
      'sea',
      'satellite',
      'state-lines-satellite',
      'coastline',
      'boundary_2',
      'boundary_disputed',
      'city_dots',
      'state_abbreviations',
      'label_state',
      'city_names',
      'label_country_1',
      'city_names_game',
    ])
  })

  const visibility = (mapType: 'plain' | 'satellite', id: string) =>
    (globeStyle(liberty, theme, mapType).layers.find((l) => l.id === id)?.layout as { visibility?: string } | undefined)?.visibility

  it('draws the plain map unless told otherwise, with the satellite imagery hidden', () => {
    expect(visibility('plain', 'satellite')).toBe('none')
    expect(visibility('plain', 'coastline')).toBe('visible')
    expect(style()).toEqual(globeStyle(liberty, theme, 'plain'))
  })

  it("draws the satellite map as EOX's cloudless imagery over the theme's surface, with no coastlines", () => {
    const satellite = globeStyle(liberty, theme, 'satellite')
    expect(satellite.sources.satellite).toMatchObject({
      type: 'raster',
      tiles: ['https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2024_3857/default/g/{z}/{y}/{x}.jpg'],
    })
    expect(satellite.layers.find((l) => l.id === 'satellite')).toMatchObject({ type: 'raster', source: 'satellite' })
    expect(visibility('satellite', 'satellite')).toBe('visible')
    expect(visibility('satellite', 'coastline')).toBe('none')
    expect(visibility('satellite', 'sea')).toBe('none')
  })

  it('keeps the borders, state lines and place names on the satellite map as on the plain map', () => {
    const ids = (mapType: 'plain' | 'satellite') => globeStyle(liberty, theme, mapType).layers.map((l) => l.id)
    expect(ids('satellite')).toEqual(ids('plain'))
    const kept = (mapType: 'plain' | 'satellite') =>
      globeStyle(liberty, theme, mapType).layers.filter((l) => !['state-lines', 'sea', 'satellite', 'state-lines-satellite', 'coastline'].includes(l.id))
    expect(kept('satellite')).toEqual(kept('plain'))
  })

  it('switches map type by showing and hiding layers, as a restyle in place', () => {
    const toSatellite = layerChanges(globeStyle(liberty, theme, 'plain').layers, globeStyle(liberty, theme, 'satellite').layers)
    expect(toSatellite).toEqual([
      { layer: 'state-lines', kind: 'layout', property: 'visibility', value: 'none' },
      { layer: 'sea', kind: 'layout', property: 'visibility', value: 'none' },
      { layer: 'satellite', kind: 'layout', property: 'visibility', value: 'visible' },
      { layer: 'state-lines-satellite', kind: 'layout', property: 'visibility', value: 'visible' },
      { layer: 'coastline', kind: 'layout', property: 'visibility', value: 'none' },
    ])
  })

  it("draws the land in the theme's globe surface and the sea in its sea color, with coastlines from the water edges", () => {
    expect(paint('background')['background-color']).toBe('#000001')
    expect(layer('sea')).toMatchObject({ type: 'fill', 'source-layer': 'water' })
    expect(paint('sea')['fill-color']).toBe('#000006')
    expect(layer('coastline')).toMatchObject({ type: 'line', 'source-layer': 'water' })
  })

  it('colors oceans and lakes as the sea, not rivers', () => {
    const { filter } = featureFilter((layer('sea') as { filter: FilterSpecification }).filter, 'sea.filter')
    const isSea = (waterClass: string) => filter({ zoom: 6 }, { type: 3, properties: { class: waterClass } } as never)
    expect(isSea('ocean')).toBe(true)
    expect(isSea('lake')).toBe(true)
    expect(isSea('river')).toBe(false)
  })

  it("draws coastlines, country borders, state lines and disputed borders in the theme's colors", () => {
    expect(paint('coastline')['line-color']).toBe('#000002')
    expect(paint('boundary_2')['line-color']).toBe('#000003')
    expect(paint('state-lines')['line-color']).toBe('#000004')
    expect(paint('boundary_disputed')['line-color']).toBe('#000005')
  })

  it("draws each kind of line at the theme's widths as the map zooms", () => {
    const width = (id: string, zoom: number) => atZoom(paint(id)['line-width'], zoom)
    expect(width('coastline', 0)).toBeCloseTo(0.5, 6)
    expect(width('coastline', 5)).toBeCloseTo(1.25, 6)
    expect(width('coastline', 12)).toBeCloseTo(2, 6)
    expect(width('boundary_2', 2)).toBeCloseTo(0.7, 6)
    expect(width('boundary_2', 6)).toBeCloseTo(1.5, 6)
    expect(width('state-lines', 5.5)).toBeCloseTo(0.75, 6)
    expect(width('boundary_disputed', 3)).toBeCloseTo(0.9, 6)
    expect(width('boundary_disputed', 10)).toBeCloseTo(0.9, 6)
  })

  it('outlines only the sea, not lakes or rivers', () => {
    const { filter } = featureFilter((layer('coastline') as { filter: FilterSpecification }).filter, 'coastline.filter')
    const outlined = (waterClass: string) => filter({ zoom: 6 }, { type: 3, properties: { class: waterClass } } as never)
    expect(outlined('ocean')).toBe(true)
    expect(outlined('lake')).toBe(false)
    expect(outlined('river')).toBe(false)
  })

  it('fetches the state lines only when told to, once the globe is ready', () => {
    const setData = vi.fn()
    showStateLines({ getSource: ((id: string) => (id === 'state-lines' ? { setData } : undefined)) as never })
    expect(setData).toHaveBeenCalledWith(expect.stringContaining('stateLines'))
    expect(() => showStateLines({ getSource: (() => undefined) as never })).not.toThrow()
  })

  it("draws the globe's own state lines at every zoom, starting with none, in place of the tiles' (under the sea on the plain map, over the imagery on the satellite map), and state names at the base style's zooms", () => {
    expect(layer('state-lines')).toMatchObject({ type: 'line', source: 'state-lines' })
    expect(layer('state-lines-satellite')).toMatchObject({ type: 'line', source: 'state-lines', paint: layer('state-lines')?.paint })
    expect(layer('state-lines')).not.toHaveProperty('minzoom')
    expect(layer('state-lines')).not.toHaveProperty('maxzoom')
    expect(style().sources['state-lines']).toEqual({ type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
    expect(layer('boundary_3')).toBeUndefined()
    expect(layer('label_state')).toMatchObject({ minzoom: 5, maxzoom: 8 })
    expect(paint('label_state')).not.toHaveProperty('text-opacity')
  })

  const tokyo: ListedCity = { name: 'Tokyo', country: 'Japan', longitude: 139.75, latitude: 35.69, population: 35_676_000, capital: true }
  const osaka: ListedCity = { name: 'Osaka', country: 'Japan', longitude: 135.46, latitude: 34.75, population: 11_294_000, capital: false }
  const kobe: ListedCity = { name: 'Kobe', country: 'Japan', longitude: 135.17, latitude: 34.68, population: 1_528_000, capital: false }
  /** A city's properties in the city name source, labeled for a game or not. */
  const properties = (city: ListedCity, game: boolean) =>
    cityNameFeatures(game ? { gameCities: [city], otherBigCities: [] } : { gameCities: [], otherBigCities: [city] }).features[0].properties
  /** The layers that name this city, labeled for a game or not. */
  const namedBy = (city: ListedCity, game: boolean) =>
    style()
      .layers.filter((l) => l.type === 'symbol' && l.source === cityNameSource)
      .filter((l) =>
        featureFilter((l as { filter: FilterSpecification }).filter, 'f').filter({ zoom: 5 }, {
          type: 1,
          properties: properties(city, game),
        } as never),
      )
      .map((l) => l.id)

  it("names each city from the city list in one layer, by whether it's a game's, a national capital like any other", () => {
    expect(style().sources[cityNameSource]).toMatchObject({ type: 'geojson' })
    expect(namedBy(osaka, false)).toEqual(['city_names'])
    expect(namedBy(tokyo, false)).toEqual(['city_names'])
    expect(namedBy(kobe, true)).toEqual(['city_names_game'])
    expect(namedBy(tokyo, true)).toEqual(['city_names_game'])
  })

  it('names cities at every zoom, as score cards show at every zoom', () => {
    for (const id of ['city_names', 'city_names_game']) {
      expect(layer(id)?.minzoom, id).toBeUndefined()
      expect(layout(id)['text-field'], id).toEqual(['get', 'name'])
    }
  })

  it("places the more populous of two cities first, Big or games', so a nearby smaller one gives way", () => {
    for (const id of ['city_names', 'city_names_game']) {
      const parsed = createExpression(layout(id)['symbol-sort-key'] as ExpressionSpecification, id)
      if (parsed.result !== 'success') throw new Error(parsed.value.map((e) => e.message).join('; '))
      const key = (city: ListedCity) => parsed.value.evaluate({ zoom: 5 }, { type: 'Point', properties: properties(city, false) } as never)
      expect(key(osaka), id).toBeLessThan(key(kobe) as number)
    }
  })

  it("writes every city's name in one spot, right of its dot and level with it, never moving to another side or over another name", () => {
    for (const id of ['city_names', 'city_names_game']) {
      expect(layout(id)['text-anchor'], id).toBe('left')
      expect(layout(id)['text-justify'], id).toBe('left')
      expect((layout(id)['text-offset'] as number[])[0], id).toBeGreaterThan(0)
      expect((layout(id)['text-offset'] as number[])[1], id).toBe(0)
      expect(layout(id), id).not.toHaveProperty('text-variable-anchor-offset')
      expect(layout(id), id).not.toHaveProperty('text-variable-anchor')
      expect(layout(id)['text-allow-overlap'], id).toBeUndefined()
    }
  })

  it("places the games' city names before every other name, so only a more populous game's city's name hides one", () => {
    const names = style().layers.filter((l) => l.type === 'symbol')
    // MapLibre places the top layer first.
    expect(names.at(-1)?.id).toBe('city_names_game')
  })

  it("puts a dot at each named city, in its name's color ringed in its outline color at the theme's sizes, showing only while its name is written", () => {
    expect(layer('city_dots')).toMatchObject({ type: 'circle', source: cityNameSource })
    expect(paint('city_dots')['circle-color']).toBe('#100001')
    expect(paint('city_dots')['circle-radius']).toBe(1.75)
    expect(paint('city_dots')['circle-stroke-color']).toBe('#200001')
    expect(paint('city_dots')['circle-stroke-width']).toBe(0.5)
    for (const property of ['circle-opacity', 'circle-stroke-opacity']) {
      const parsed = createExpression(paint('city_dots')[property] as ExpressionSpecification, property)
      if (parsed.result !== 'success') throw new Error(parsed.value.map((e) => e.message).join('; '))
      const opacity = (state: Record<string, unknown>) => parsed.value.evaluate({ zoom: 5 }, { type: 'Point', properties: {} } as never, state)
      expect(opacity({ named: true }), property).toBe(1)
      expect(opacity({}), property).toBe(0)
      expect(opacity({ named: true, horizonFade: 0.5 }), property).toBe(0.5)
    }
  })

  it('abbreviates US states and Canadian provinces and territories zoomed out, to their postal codes, until the full names show', () => {
    const states = style().sources[stateNameSource] as { type: string; data: { features: { properties: { postal: string } }[] } }
    expect(states.type).toBe('geojson')
    const postal = states.data.features.map((f) => f.properties.postal)
    expect(postal).toHaveLength(63)
    expect(postal).toEqual(expect.arrayContaining(['WA', 'TX', 'HI', 'ON', 'BC', 'NU']))
    expect(postal).not.toContain('DC')
    expect(layer('state_abbreviations')).toMatchObject({ type: 'symbol', source: stateNameSource, maxzoom: 5 })
    expect(layer('state_abbreviations')).not.toHaveProperty('minzoom')
    expect(layout('state_abbreviations')['text-field']).toEqual(['get', 'postal'])
    expect(layer('label_state')).toMatchObject({ minzoom: 5 })
  })

  it('finds the first place-name layer, for pins to go beneath', () => {
    const globe = style()
    const first = firstPlaceNameLayer(globe)
    expect(first).toBe('state_abbreviations')
    const beneath = globe.layers.slice(0, globe.layers.findIndex((l) => l.id === first))
    expect(beneath.every((l) => l.type !== 'symbol')).toBe(true)
    // Cities' dots too, so a pin on one covers it.
    expect(beneath.map((l) => l.id)).toContain('city_dots')
  })

  it("writes each kind of place name in the theme's color, outline (its color, width and blur) and font, from the map's font server", () => {
    expect(style().glyphs).toBe(glyphsUrl)
    const kinds = {
      city_names: 'city',
      city_names_game: 'city',
      state_abbreviations: 'state',
      label_state: 'state',
      label_country_1: 'country',
    } as const
    for (const [id, kind] of Object.entries(kinds)) {
      const look = theme.components.PlaceNames[kind]
      expect(paint(id)['text-color'], id).toBe(look.color)
      expect(paint(id)['text-halo-color'], id).toBe(look.outline.color)
      expect(paint(id)['text-halo-width'], id).toBe(look.outline.width)
      expect(paint(id)['text-halo-blur'], id).toBe(look.outline.blur)
      expect(layout(id)['text-font'], id).toEqual([look.font.name])
    }
  })

  it('names each state and country once, in English, falling back to its Latin spelling, then its own name', () => {
    const named = (id: string, properties: Record<string, string>) => {
      const parsed = createExpression(layout(id)['text-field'] as ExpressionSpecification, id)
      if (parsed.result !== 'success') throw new Error(parsed.value.map((e) => e.message).join('; '))
      return parsed.value.evaluate({ zoom: 3 }, { type: 'Point', properties } as never)
    }
    const russia = { name: 'Россия', 'name:latin': 'Rossiya', 'name:nonlatin': 'Россия', 'name:en': 'Russia', name_en: 'Russia' }
    for (const id of ['label_state', 'label_country_1']) {
      expect(named(id, russia), id).toBe('Russia')
      expect(named(id, { name: 'Монгол улс', name_en: 'Mongolia' }), id).toBe('Mongolia')
      expect(named(id, { name: 'Ελλάδα', 'name:latin': 'Elláda' }), id).toBe('Elláda')
      expect(named(id, { name: 'Chile' }), id).toBe('Chile')
    }
  })

  it('writes state and country names in capitals, city names as they are', () => {
    for (const id of ['state_abbreviations', 'label_state', 'label_country_1']) expect(layout(id)['text-transform'], id).toBe('uppercase')
    for (const id of ['city_names', 'city_names_game']) expect(layout(id)['text-transform'], id).toBe('none')
  })

  it("spaces each kind of place's name out as far as the theme says", () => {
    expect(layout('city_names')['text-letter-spacing']).toBe(0.03)
    expect(layout('city_names_game')['text-letter-spacing']).toBe(0.03)
    expect(layout('label_state')['text-letter-spacing']).toBe(0.3)
    expect(layout('label_country_1')['text-letter-spacing']).toBe(0.2)
  })

  it("dashes disputed borders in the theme's pattern", () => {
    expect(paint('boundary_disputed')['line-dasharray']).toEqual([3, 1])
  })

  it("turns off MapLibre's one-sided atmosphere", () => {
    expect(style().sky).toEqual({ 'atmosphere-blend': 0 })
  })

  it('fails loudly when the base style lacks a layer the globe needs', () => {
    const noCountries = base(liberty.layers.filter((l) => l.id !== 'boundary_2'))
    expect(() => style(noCountries)).toThrow(/boundary_2/)
  })
})
