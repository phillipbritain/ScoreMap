import { createExpression, type ExpressionSpecification } from '@maplibre/maplibre-gl-style-spec'
import type { StyleSpecification, SymbolLayerSpecification } from 'maplibre-gl'
import { describe, expect, it } from 'vitest'
import { cityNameLook, mapFonts, placeNameLayers } from './placeNames'

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

const layout = (id: string) =>
  (placeNameLayers(base).find((l) => l.id === id) as SymbolLayerSpecification).layout as Record<string, unknown>

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
        expect(cityNameLook(zoom, capital).size, `${id} at ${zoom}`).toBeCloseTo(atZoom(layout(id)['text-size'], zoom), 6)
      }
    }
  })

  it("predicts how far below its dot the map writes a city's name, at every zoom", () => {
    for (const zoom of zooms) {
      const look = cityNameLook(zoom, false)
      const ems = atZoom(layout('label_city')['text-radial-offset'], zoom)
      expect(look.offset, `at ${zoom}`).toBeCloseTo(ems * look.size, 6)
    }
  })

  it('measures a name in the weight of the font the map writes it in', () => {
    const fonts = Object.values(mapFonts)
    for (const [id, capital] of [
      ['label_city', false],
      ['label_city_capital', true],
    ] as const) {
      const font = fonts.find((f) => f.name === (layout(id)['text-font'] as string[])[0])!
      expect(cityNameLook(5, capital).font, id).toMatch(new RegExp(`^${font.weight} `))
    }
  })
})
