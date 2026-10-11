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
import { firstPlaceNameLayer, gameCitiesState, gameCityPlaces } from './placeNames'

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
  globe: {
    surface: '#000001',
    coastlines: { color: '#000002', width: { '1': 0.5, '9': 2 } },
    countryBorders: { color: '#000003', width: { '2': 0.7, '6': 1.5 } },
    stateLines: { color: '#000004', width: { '4': 0.4, '7': 1.1 } },
    disputedBorders: { color: '#000005', width: { '0': 0.9 }, dash: [3, 1] },
    halo: builtInTheme.globe.halo,
  },
  placeNames: {
    city: { ...builtInTheme.placeNames.city, color: '#100001', outline: outline('#200001', 2.5, 0.25), font: font('Open Sans Light'), letterSpacing: 0.03 },
    capital: { ...builtInTheme.placeNames.capital, color: '#100002', outline: outline('#200002', 3, 0.75), font: font('Open Sans Extra Bold'), letterSpacing: 0 },
    state: { ...builtInTheme.placeNames.state, color: '#100003', outline: outline('#200003', 1.5, 0), font: font('Metropolis Regular'), letterSpacing: 0.3 },
    country: { ...builtInTheme.placeNames.country, color: '#100004', outline: outline('#200004', 1, 1), font: font('Klokantech Noto Sans Bold'), letterSpacing: 0.2 },
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
  it("keeps only the lines and place names, dropping roads, land cover, points of interest, and towns and villages but for games'", () => {
    expect(style().layers.map((l) => l.id)).toEqual([
      'background',
      'coastline',
      'boundary_3',
      'boundary_2',
      'boundary_disputed',
      'label_city',
      'label_state',
      'label_city_capital',
      'label_country_1',
      'label_village_game',
      'label_city_game',
      'label_town_game',
      'label_city_capital_game',
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

  it('shows state lines at every zoom and state names from zoom 3 to 8', () => {
    expect(layer('boundary_3')?.minzoom).toBe(0)
    expect(layer('label_state')).toMatchObject({ minzoom: 3, maxzoom: 8 })
  })

  it('starts state names unseen, until all of them in view fit', () => {
    expect(layer('label_state')).toMatchObject({ paint: { 'text-opacity': 0 } })
  })

  it('names only major cities, capitals included, at every zoom', () => {
    for (const id of ['label_city', 'label_city_capital']) {
      const { filter } = featureFilter((layer(id) as { filter: FilterSpecification }).filter, `${id}.filter`)
      const named = (zoom: number, rank: number) =>
        filter({ zoom }, { type: 1, properties: { class: 'city', capital: 2, rank } } as never)
      expect(named(3, 1)).toBe(true) // New York
      expect(named(3, 4)).toBe(true) // Nashville, Ottawa
      expect(named(10, 4)).toBe(true)
      expect(named(10, 5)).toBe(false) // Austin, Orlando
      expect(named(3, 5)).toBe(false)
    }
  })

  it("keeps the base style's own city filters", () => {
    const { filter } = featureFilter((layer('label_city') as { filter: FilterSpecification }).filter, 'f')
    expect(filter({ zoom: 5 }, { type: 1, properties: { class: 'town', rank: 1 } } as never)).toBe(false)
  })

  it('places larger cities first, so a nearby smaller city gives way', () => {
    for (const id of ['label_city', 'label_city_capital']) {
      expect(layer(id)).toMatchObject({
        layout: { 'symbol-sort-key': ['coalesce', ['get', 'rank'], 99] },
      })
    }
  })

  it('puts city names below their dot by preference, moving to another side when a card is there', () => {
    for (const id of ['label_city', 'label_city_capital']) {
      const layout = layer(id)?.layout as Record<string, unknown>
      expect(layout['text-variable-anchor']).toEqual(['top', 'bottom', 'left', 'right'])
      // A fixed anchor or offset would stop the name moving.
      expect(layout).not.toHaveProperty('text-anchor')
      expect(layout).not.toHaveProperty('text-offset')
    }
  })

  it("names a game's city only in its own layer, placed before every other name and always written below its dot", () => {
    const cityFeature = { type: 1, id: 42, properties: { class: 'city', capital: 0, rank: 3 } } as never
    const otherCity = { type: 1, id: 7, properties: { class: 'city', capital: 0, rank: 3 } } as never
    const state = { [gameCitiesState]: [42] }
    const named = (id: string, feature: never) =>
      featureFilter((layer(id) as { filter: FilterSpecification }).filter, 'f', state).filter({ zoom: 5 }, feature)
    expect(named('label_city_game', cityFeature)).toBe(true)
    expect(named('label_city', cityFeature)).toBe(false)
    expect(named('label_city_game', otherCity)).toBe(false)
    expect(named('label_city', otherCity)).toBe(true)

    const layout = layer('label_city_game')?.layout as Record<string, unknown>
    expect(layout['text-variable-anchor']).toEqual(['top'])
    expect(layout['text-allow-overlap']).toBe(true)
    expect(style().state).toEqual({ [gameCitiesState]: { default: [] } })
  })

  it("names a game's place however small: a minor city or a town", () => {
    const state = { [gameCitiesState]: [42] }
    const named = (id: string, properties: Record<string, unknown>) =>
      featureFilter((layer(id) as { filter: FilterSpecification }).filter, 'f', state).filter(
        { zoom: 10 },
        { type: 1, id: 42, properties } as never,
      )
    expect(named('label_city_game', { class: 'city', capital: 0, rank: 9 })).toBe(true) // Tuscaloosa
    expect(named('label_town_game', { class: 'town', rank: 12 })).toBe(true) // State College
    expect(named('label_city', { class: 'city', capital: 0, rank: 9 })).toBe(false)
    expect(layer('label_town_game')).toMatchObject({ layout: { 'text-variable-anchor': ['top'] } })
  })

  it("finds a game's place among the tiles' cities, towns and villages", () => {
    const { filter } = featureFilter(gameCityPlaces, 'f')
    const found = (placeClass: string) => filter({ zoom: 10 }, { type: 1, properties: { class: placeClass } } as never)
    expect(['city', 'town', 'village'].map(found)).toEqual([true, true, true])
    expect(['state', 'country', 'suburb'].map(found)).toEqual([false, false, false])
  })

  it('finds the first place-name layer, for pins to go beneath', () => {
    const globe = style()
    const first = firstPlaceNameLayer(globe)
    expect(first).toBe('label_city')
    const lines = globe.layers.slice(0, globe.layers.findIndex((l) => l.id === first))
    expect(lines.every((l) => l.type !== 'symbol')).toBe(true)
  })

  it("writes each kind of place name in the theme's colour, outline (its colour, width and blur) and font, from the map's font server", () => {
    expect(style().glyphs).toBe(glyphsUrl)
    const kinds = {
      label_city: 'city',
      label_city_game: 'city',
      label_town_game: 'city',
      label_village_game: 'city',
      label_city_capital: 'capital',
      label_city_capital_game: 'capital',
      label_state: 'state',
      label_country_1: 'country',
    } as const
    for (const [id, kind] of Object.entries(kinds)) {
      const look = theme.placeNames[kind]
      expect(paint(id)['text-color'], id).toBe(look.color)
      expect(paint(id)['text-halo-color'], id).toBe(look.outline.color)
      expect(paint(id)['text-halo-width'], id).toBe(look.outline.width)
      expect(paint(id)['text-halo-blur'], id).toBe(look.outline.blur)
      expect(layout(id)['text-font'], id).toEqual([look.font.name])
    }
  })

  it('writes state and country names in capitals, city names as they are', () => {
    for (const id of ['label_state', 'label_country_1']) expect(layout(id)['text-transform'], id).toBe('uppercase')
    for (const id of ['label_city', 'label_city_capital']) expect(layout(id)['text-transform'], id).toBe('none')
  })

  it("spaces each kind of place's name out as far as the theme says", () => {
    expect(layout('label_city')['text-letter-spacing']).toBe(0.03)
    expect(layout('label_city_capital')['text-letter-spacing']).toBe(0)
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
