import type { StyleSpecification } from 'maplibre-gl'
import { describe, expect, it } from 'vitest'
import { globeStyle } from './globeStyle'

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
  { id: 'label_city', type: 'symbol', ...tiles, 'source-layer': 'place' },
  { id: 'label_state', type: 'symbol', ...tiles, 'source-layer': 'place', minzoom: 5, maxzoom: 8 },
  { id: 'label_country_1', type: 'symbol', ...tiles, 'source-layer': 'place' },
])

const layer = (id: string) => globeStyle(liberty).layers.find((l) => l.id === id)

describe('globeStyle', () => {
  it('keeps only the lines and place names, dropping roads, land cover and points of interest', () => {
    expect(globeStyle(liberty).layers.map((l) => l.id)).toEqual([
      'background',
      'coastline',
      'boundary_3',
      'boundary_2',
      'boundary_disputed',
      'label_city',
      'label_state',
      'label_country_1',
    ])
  })

  it('draws land and sea the same colour, with coastlines from the water edges', () => {
    expect(layer('background')).toMatchObject({ paint: { 'background-color': '#0b1526' } })
    expect(layer('coastline')).toMatchObject({ type: 'line', 'source-layer': 'water' })
  })

  it('shows state lines at every zoom and state names from zoom 3 to 8', () => {
    expect(layer('boundary_3')?.minzoom).toBe(0)
    expect(layer('label_state')).toMatchObject({ minzoom: 3, maxzoom: 8 })
  })

  it('makes country names brighter than other place names', () => {
    const colour = (id: string) => (layer(id)?.paint as Record<string, unknown> | undefined)?.['text-color']
    expect(colour('label_country_1')).not.toBe(colour('label_city'))
  })

  it("turns off MapLibre's one-sided atmosphere", () => {
    expect(globeStyle(liberty).sky).toEqual({ 'atmosphere-blend': 0 })
  })

  it('fails loudly when the base style lacks a layer the globe needs', () => {
    const noStates = base(liberty.layers.filter((l) => l.id !== 'boundary_3'))
    expect(() => globeStyle(noStates)).toThrow(/boundary_3/)
  })
})
