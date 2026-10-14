import {
  createExpression,
  featureFilter,
  type ExpressionSpecification,
  type FilterSpecification,
} from '@maplibre/maplibre-gl-style-spec'
import type { StyleSpecification } from 'maplibre-gl'
import { describe, expect, it } from 'vitest'
import { builtInTheme } from '../theme/builtInTheme'
import { globeFonts, glyphsUrl } from '../theme/globeFonts'
import type { Theme } from '../theme/theme'
import { globeStyle } from './globeStyle'
import type { ListedCity } from './cityLabels'
import { cityNameFeatures, cityNameSource, firstPlaceNameLayer } from './placeNames'

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

/** A theme with a colour and font of its own for everything the globe draws, to tell them apart. */
const theme: Theme = {
  ...builtInTheme,
  components: {
    ...builtInTheme.components,
    Globe: {
      surface: '#000001',
      coastlines: { color: '#000002', width: { '1': 0.5, '9': 2 } },
      countryBorders: { color: '#000003', width: { '2': 0.7, '6': 1.5 } },
      stateLines: { color: '#000004', width: { '4': 0.4, '7': 1.1 } },
      disputedBorders: { color: '#000005', width: { '0': 0.9 }, dash: [3, 1] },
      halo: builtInTheme.components.Globe.halo,
    },
    PlaceNames: {
      city: { ...builtInTheme.components.PlaceNames.city, color: '#100001', outline: outline('#200001', 2.5, 0.25), font: font('Open Sans Light'), letterSpacing: 0.03 },
      capital: { ...builtInTheme.components.PlaceNames.capital, color: '#100002', outline: outline('#200002', 3, 0.75), font: font('Open Sans Extra Bold'), letterSpacing: 0 },
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
      'coastline',
      'boundary_3',
      'boundary_2',
      'boundary_disputed',
      'city_names',
      'capital_names',
      'label_state',
      'label_country_1',
      'city_names_game',
      'capital_names_game',
    ])
  })

  it("draws land and sea alike in the theme's globe surface, with coastlines from the water edges", () => {
    expect(paint('background')['background-color']).toBe('#000001')
    expect(layer('coastline')).toMatchObject({ type: 'line', 'source-layer': 'water' })
  })

  it("draws coastlines, country borders, state lines and disputed borders in the theme's colours", () => {
    expect(paint('coastline')['line-color']).toBe('#000002')
    expect(paint('boundary_2')['line-color']).toBe('#000003')
    expect(paint('boundary_3')['line-color']).toBe('#000004')
    expect(paint('boundary_disputed')['line-color']).toBe('#000005')
  })

  it("draws each kind of line at the theme's widths as the map zooms", () => {
    const width = (id: string, zoom: number) => atZoom(paint(id)['line-width'], zoom)
    expect(width('coastline', 0)).toBeCloseTo(0.5, 6)
    expect(width('coastline', 5)).toBeCloseTo(1.25, 6)
    expect(width('coastline', 12)).toBeCloseTo(2, 6)
    expect(width('boundary_2', 2)).toBeCloseTo(0.7, 6)
    expect(width('boundary_2', 6)).toBeCloseTo(1.5, 6)
    expect(width('boundary_3', 5.5)).toBeCloseTo(0.75, 6)
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

  it("shows state lines at every zoom, and state names at the base style's zooms", () => {
    expect(layer('boundary_3')?.minzoom).toBe(0)
    expect(layer('label_state')).toMatchObject({ minzoom: 5, maxzoom: 8 })
    expect(paint('label_state')).not.toHaveProperty('text-opacity')
  })

  const tokyo: ListedCity = { name: 'Tokyo', country: 'Japan', longitude: 139.75, latitude: 35.69, population: 35_676_000, capital: true }
  const osaka: ListedCity = { name: 'Osaka', country: 'Japan', longitude: 135.46, latitude: 34.75, population: 11_294_000, capital: false }
  const kobe: ListedCity = { name: 'Kobe', country: 'Japan', longitude: 135.17, latitude: 34.68, population: 1_528_000, capital: false }
  /** A city's properties in the city name source, labelled for a game or not. */
  const properties = (city: ListedCity, game: boolean) =>
    cityNameFeatures(game ? { gameCities: [city], otherBigCities: [] } : { gameCities: [], otherBigCities: [city] }).features[0].properties
  /** The layers that name this city, labelled for a game or not. */
  const namedBy = (city: ListedCity, game: boolean) =>
    style()
      .layers.filter((l) => 'source' in l && l.source === cityNameSource)
      .filter((l) =>
        featureFilter((l as { filter: FilterSpecification }).filter, 'f').filter({ zoom: 5 }, {
          type: 1,
          properties: properties(city, game),
        } as never),
      )
      .map((l) => l.id)

  it("names each city from the city list in one layer, by whether it's a game's and a capital", () => {
    expect(style().sources[cityNameSource]).toMatchObject({ type: 'geojson' })
    expect(namedBy(osaka, false)).toEqual(['city_names'])
    expect(namedBy(tokyo, false)).toEqual(['capital_names'])
    expect(namedBy(kobe, true)).toEqual(['city_names_game'])
    expect(namedBy(tokyo, true)).toEqual(['capital_names_game'])
  })

  it('names cities from zoom 3', () => {
    for (const id of ['city_names', 'capital_names', 'city_names_game', 'capital_names_game']) {
      expect(layer(id)?.minzoom, id).toBe(3)
      expect(layout(id)['text-field'], id).toEqual(['get', 'name'])
    }
  })

  it('places the more populous of two Big cities first, so a nearby smaller one gives way', () => {
    for (const id of ['city_names', 'capital_names']) {
      const parsed = createExpression(layout(id)['symbol-sort-key'] as ExpressionSpecification, id)
      if (parsed.result !== 'success') throw new Error(parsed.value.map((e) => e.message).join('; '))
      const key = (city: ListedCity) => parsed.value.evaluate({ zoom: 5 }, { type: 'Point', properties: properties(city, false) } as never)
      expect(key(osaka), id).toBeLessThan(key(kobe) as number)
    }
  })

  it('puts Big city names below their dot by preference, moving to another side when a card is there', () => {
    for (const id of ['city_names', 'capital_names']) {
      expect(layout(id)['text-variable-anchor'], id).toEqual(['top', 'bottom', 'left', 'right'])
      expect(layout(id)['text-allow-overlap'], id).toBeUndefined()
    }
  })

  it("always writes a game's city below its dot, whatever else is there", () => {
    for (const id of ['city_names_game', 'capital_names_game']) {
      expect(layout(id)['text-variable-anchor'], id).toEqual(['top'])
      expect(layout(id)['text-allow-overlap'], id).toBe(true)
    }
  })

  it('finds the first place-name layer, for pins to go beneath', () => {
    const globe = style()
    const first = firstPlaceNameLayer(globe)
    expect(first).toBe('city_names')
    const lines = globe.layers.slice(0, globe.layers.findIndex((l) => l.id === first))
    expect(lines.every((l) => l.type !== 'symbol')).toBe(true)
  })

  it("writes each kind of place name in the theme's colour, outline (its colour, width and blur) and font, from the map's font server", () => {
    expect(style().glyphs).toBe(glyphsUrl)
    const kinds = {
      city_names: 'city',
      city_names_game: 'city',
      capital_names: 'capital',
      capital_names_game: 'capital',
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

  it('writes state and country names in capitals, city names as they are', () => {
    for (const id of ['label_state', 'label_country_1']) expect(layout(id)['text-transform'], id).toBe('uppercase')
    for (const id of ['city_names', 'capital_names_game']) expect(layout(id)['text-transform'], id).toBe('none')
  })

  it("spaces each kind of place's name out as far as the theme says", () => {
    expect(layout('city_names')['text-letter-spacing']).toBe(0.03)
    expect(layout('capital_names')['text-letter-spacing']).toBe(0)
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
    const noStates = base(liberty.layers.filter((l) => l.id !== 'boundary_3'))
    expect(() => style(noStates)).toThrow(/boundary_3/)
  })
})
