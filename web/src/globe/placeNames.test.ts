import { createExpression, type ExpressionSpecification } from '@maplibre/maplibre-gl-style-spec'
import type { GeoJSONSource, Map as MapLibreMap, StyleSpecification, SymbolLayerSpecification } from 'maplibre-gl'
import type { FeatureCollection } from 'geojson'
import { describe, expect, it } from 'vitest'
import type { Game } from '../games/game'
import { builtInTheme } from '../theme/builtInTheme'
import { globeFonts } from '../theme/globeFonts'
import type { Theme } from '../theme/theme'
import { cityLabelSettings } from './cityLabels'
import { addPlaceNames, cityNameLook, placeNameLayers } from './placeNames'

const place = { type: 'symbol', source: 'openmaptiles', 'source-layer': 'place' } as const
const base: StyleSpecification = {
  version: 8,
  sources: { openmaptiles: { type: 'vector', url: 'https://example.test' } },
  layers: [
    { id: 'label_city', ...place, filter: ['==', ['get', 'class'], 'city'] },
    { id: 'label_state', ...place },
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
    for (const id of ['city_names', 'city_names_game']) {
      for (const zoom of zooms) {
        expect(cityNameLook(zoom, builtInTheme).size, `${id} at ${zoom}`).toBeCloseTo(atZoom(layout(id)['text-size'], zoom), 6)
      }
    }
  })

  it("predicts how far below its dot the map writes a city's name, at every zoom", () => {
    for (const zoom of zooms) {
      const look = cityNameLook(zoom, builtInTheme)
      const ems = atZoom(layout('city_names')['text-radial-offset'], zoom)
      expect(look.offset, `at ${zoom}`).toBeCloseTo(ems * look.size, 6)
    }
  })

  it('wraps a name wider than 8 ems, as the base style does', () => {
    expect(cityNameLook(7, builtInTheme)).toMatchObject({ size: 14, maxWidth: 112 })
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
    expect(size('city_names', 1)).toBeCloseTo(10, 6)
    expect(size('city_names', 2)).toBeCloseTo(10, 6)
    expect(size('city_names', 4)).toBeGreaterThan(10)
    expect(size('city_names', 4)).toBeLessThan(20)
    expect(size('city_names', 6)).toBeCloseTo(20, 6)
    expect(size('city_names', 9)).toBeCloseTo(20, 6)
    expect(cityNameLook(9, theme).size).toBeCloseTo(20, 6)
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
        },
      },
    }
    expect(layout('city_names', theme)['text-font']).toEqual(['Metropolis Light'])
    expect(layout('city_names_game', theme)['text-font']).toEqual(['Metropolis Light'])
    expect(cityNameLook(5, theme).font).toMatch(/^normal 300 [\d.]+px "Metropolis", sans-serif$/)
  })
})

describe('addPlaceNames', () => {
  // A map with just the city name source, keeping the features last given to it.
  function mapWithCityNames() {
    let features: FeatureCollection | null = null
    const source = { setData: (data: FeatureCollection) => (features = data) } as unknown as GeoJSONSource
    const map = { getSource: () => source, on: () => map, off: () => map } as unknown as MapLibreMap
    const gameCities = () => features!.features.filter((f) => f.properties!.game).map((f) => f.properties!.name as string)
    return { map, gameCities }
  }
  // Everglades City, about 100 km from Miami.
  const evergladesGame = { venue: { longitude: -81.3851, latitude: 25.8573 } } as Game

  it('names the shown games afresh by new settings', () => {
    const { map, gameCities } = mapWithCityNames()
    const names = addPlaceNames(map, () => builtInTheme, { ...cityLabelSettings, gameCityKm: 50 })
    names.showGames([evergladesGame])
    expect(gameCities()).toEqual([])

    names.setSettings({ ...cityLabelSettings, gameCityKm: 150 })
    expect(gameCities()).toEqual(['Miami'])
  })
})
