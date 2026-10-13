import { createExpression, type ExpressionSpecification } from '@maplibre/maplibre-gl-style-spec'
import type { StyleSpecification, SymbolLayerSpecification } from 'maplibre-gl'
import { describe, expect, it } from 'vitest'
import { builtInTheme } from '../theme/builtInTheme'
import { globeFonts } from '../theme/globeFonts'
import type { Theme } from '../theme/theme'
import { cityNameLook, placeNameLayers } from './placeNames'

const place = { type: 'symbol', source: 'openmaptiles', 'source-layer': 'place' } as const
const base: StyleSpecification = {
  version: 8,
  sources: { openmaptiles: { type: 'vector', url: 'https://example.test' } },
  layers: [
    { id: 'label_city', ...place, filter: ['==', ['get', 'class'], 'city'] },
    { id: 'label_state', ...place },
    { id: 'label_city_capital', ...place, filter: ['==', ['get', 'capital'], 2] },
  ],
}

const layout = (id: string, theme: Theme = builtInTheme) =>
  (placeNameLayers(base, theme).find((l) => l.id === id) as SymbolLayerSpecification).layout as Record<string, unknown>

/** What a layer's zoom-dependent layout value is at a zoom level, as MapLibre works it out. */
function atZoom(value: unknown, zoom: number): number {
  const parsed = createExpression(value as ExpressionSpecification, 'test')
  if (parsed.result !== 'success') throw new Error(parsed.value.map((e) => e.message).join('; '))
  return parsed.value.evaluate({ zoom }) as number
}

const zooms = [2, 3, 4, 4.5, 5.5, 7, 8.25, 11, 12.9]

describe('cityNameLook', () => {
  it('predicts the size the map writes a city name at, at every zoom', () => {
    for (const [id, capital] of [
      ['label_city', false],
      ['label_city_capital', true],
    ] as const) {
      for (const zoom of zooms) {
        expect(cityNameLook(zoom, capital, builtInTheme).size, `${id} at ${zoom}`).toBeCloseTo(atZoom(layout(id)['text-size'], zoom), 6)
      }
    }
  })

  it("predicts how far below its dot the map writes a city's name, at every zoom", () => {
    for (const zoom of zooms) {
      const look = cityNameLook(zoom, false, builtInTheme)
      const ems = atZoom(layout('label_city')['text-radial-offset'], zoom)
      expect(look.offset, `at ${zoom}`).toBeCloseTo(ems * look.size, 6)
    }
  })

  it('wraps a name wider than 8 ems, as the base style does', () => {
    expect(cityNameLook(7, true, builtInTheme)).toMatchObject({ size: 16, maxWidth: 128 })
  })

  it("writes each kind of place's name at the theme's text sizes as the map zooms", () => {
    const theme: Theme = {
      ...builtInTheme,
      components: {
        ...builtInTheme.components,
        PlaceNames: {
          ...builtInTheme.components.PlaceNames,
          city: { ...builtInTheme.components.PlaceNames.city, size: { '2': 10, '6': 20 } },
          state: { ...builtInTheme.components.PlaceNames.state, size: { '5': 14 } },
        },
      },
    }
    const size = (id: string, zoom: number) => atZoom(layout(id, theme)['text-size'], zoom)
    expect(size('label_city', 1)).toBeCloseTo(10, 6)
    expect(size('label_city', 2)).toBeCloseTo(10, 6)
    expect(size('label_city', 4)).toBeGreaterThan(10)
    expect(size('label_city', 4)).toBeLessThan(20)
    expect(size('label_city', 6)).toBeCloseTo(20, 6)
    expect(size('label_city', 9)).toBeCloseTo(20, 6)
    expect(cityNameLook(9, false, theme).size).toBeCloseTo(20, 6)
    expect(size('label_state', 3)).toBe(14)
    expect(size('label_state', 7)).toBe(14)
  })

  it("measures a name in the family, weight and style of the theme's font the map writes it in", () => {
    const font = (name: string) => globeFonts.get(name)!
    const theme: Theme = {
      ...builtInTheme,
      components: {
        ...builtInTheme.components,
        PlaceNames: {
          ...builtInTheme.components.PlaceNames,
          city: { ...builtInTheme.components.PlaceNames.city, font: font('Metropolis Light') },
          capital: { ...builtInTheme.components.PlaceNames.capital, font: font('Open Sans Bold Italic') },
        },
      },
    }
    expect(layout('label_city', theme)['text-font']).toEqual(['Metropolis Light'])
    expect(cityNameLook(5, false, theme).font).toMatch(/^normal 300 [\d.]+px "Metropolis", sans-serif$/)
    expect(layout('label_city_capital', theme)['text-font']).toEqual(['Open Sans Bold Italic'])
    expect(cityNameLook(5, true, theme).font).toMatch(/^italic 700 [\d.]+px "Open Sans", sans-serif$/)
  })
})
