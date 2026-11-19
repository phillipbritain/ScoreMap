import { createExpression, type ExpressionSpecification } from '@maplibre/maplibre-gl-style-spec'
import type { GeoJSONSource, Map as MapLibreMap, StyleSpecification, SymbolLayerSpecification } from 'maplibre-gl'
import type { FeatureCollection } from 'geojson'
import { describe, expect, it } from 'vitest'
import type { PlacedGame } from '../games/placedGames'
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

  it("predicts how far right of its dot the map writes a city's name, at every zoom", () => {
    for (const zoom of zooms) {
      const look = cityNameLook(zoom, builtInTheme)
      const [ems] = layout('city_names')['text-offset'] as number[]
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
  // A map with just the city name source, keeping the features last given to it, writing the names
  // it's told to, and keeping the cities' feature states.
  function mapWithCityNames() {
    let features: FeatureCollection | null = null
    let names: string[] = []
    const handlers = new Map<string, () => void>()
    const states = new Map<string | number, Record<string, unknown>>()
    const source = { setData: (data: FeatureCollection) => (features = data) } as unknown as GeoJSONSource
    const idOf = (name: string) => features!.features.find((f) => f.properties!.name === name)?.id
    let spread = 10
    const map = {
      getSource: () => source,
      getLayer: () => ({}),
      getZoom: () => 3,
      // A flat screen, `spread` pixels a degree, everything facing the viewer.
      project: ([longitude, latitude]: [number, number]) => ({ x: (longitude + 130) * spread, y: (50 - latitude) * spread }),
      _camera: { transform: { isLocationOccluded: () => false } },
      on: (event: string, handler: () => void) => (handlers.set(event, handler), map),
      off: () => map,
      queryRenderedFeatures: () => names.map((name) => ({ id: idOf(name), properties: { name } })),
      setFeatureState: ({ id }: { id: string | number }, state: Record<string, unknown>) => states.set(id, { ...states.get(id), ...state }),
    } as unknown as MapLibreMap
    const gameCities = () => features!.features.filter((f) => f.properties!.game).map((f) => f.properties!.name as string)
    const writtenCities = () => features!.features.filter((f) => f.properties!.written).map((f) => f.properties!.name as string)
    let given = 0
    const setData = source.setData
    source.setData = ((data: FeatureCollection) => (given++, setData(data))) as typeof source.setData
    return {
      map,
      gameCities,
      writtenCities,
      given: () => given,
      spreadTo: (pixels: number) => (spread = pixels),
      written: (cities: string[]) => (names = cities),
      emit: (event: string) => handlers.get(event)?.(),
      dotShown: (city: string) => states.get(idOf(city)!)?.named === true && states.get(idOf(city)!)?.covered !== true,
    }
  }
  // Everglades City, about 100 km from Miami.
  const evergladesGame = { id: 'everglades', venue: { longitude: -81.3851, latitude: 25.8573 } } as PlacedGame

  it('names the shown games afresh by new settings', () => {
    const { map, gameCities } = mapWithCityNames()
    const names = addPlaceNames(map, () => builtInTheme, { ...cityLabelSettings, gameCityKm: 50 })
    names.showGames([evergladesGame])
    expect(gameCities()).toEqual([])

    names.setSettings({ ...cityLabelSettings, gameCityKm: 150 })
    expect(gameCities()).toEqual(['Miami'])
  })

  it('keeps a game’s city whole near the horizon, wherever the view is centered, as its game has a score card', () => {
    const { map, gameCities } = mapWithCityNames()
    const names = addPlaceNames(map, () => builtInTheme, { ...cityLabelSettings, gameCityKm: 150 })
    names.showGames([evergladesGame])
    expect(gameCities()).toEqual(['Miami'])
    const miami = 0
    expect(names.namesAGame(miami)).toBe(true)
    // A Big city with no game near names no game.
    expect(names.namesAGame(1)).toBe(false)
  })

  it("shows a city's dot only while its name is written, following names as they come and go", () => {
    const { map, written, emit, dotShown } = mapWithCityNames()
    const names = addPlaceNames(map, () => builtInTheme, { ...cityLabelSettings, gameCityKm: 150 })
    // In Chicago, far from Miami.
    const chicagoGame = { id: 'chicago', venue: { longitude: -87.6359, latitude: 41.8789 } } as PlacedGame
    names.showGames([evergladesGame, chicagoGame])

    written(['Miami'])
    emit('idle')
    expect(dotShown('Miami')).toBe(true)
    expect(dotShown('Chicago')).toBe(false)

    written(['Chicago'])
    emit('idle')
    expect(dotShown('Miami')).toBe(false)
    expect(dotShown('Chicago')).toBe(true)

    // The games changing, the cities are numbered afresh: no dot is left on from before.
    names.showGames([chicagoGame])
    written([])
    emit('idle')
    expect(dotShown('Chicago')).toBe(false)
  })

  it("writes the more populous of two games' cities whose names overlap, sticking through small moves, and gives only written names for cards to keep clear of", () => {
    const { map, writtenCities, given, spreadTo } = mapWithCityNames()
    const names = addPlaceNames(map, () => builtInTheme, cityLabelSettings)
    const losAngeles = { id: 'la', venue: { longitude: -118.1819, latitude: 33.9919 } } as PlacedGame
    const sanDiego = { id: 'sd', venue: { longitude: -117.1819, latitude: 32.822 } } as PlacedGame
    names.showGames([losAngeles, sanDiego])
    expect(writtenCities()).toEqual(['Los Angeles', 'San Diego'])

    // Close together, San Diego's name, under Los Angeles', gives way.
    spreadTo(10)
    expect(names.layOutGameNames()).toHaveLength(1)
    expect(writtenCities()).toEqual(['Los Angeles'])
    // Brought apart a little, it stays out, and nothing is given the map again.
    const before = given()
    spreadTo(10.5)
    expect(names.layOutGameNames()).toHaveLength(1)
    expect(given()).toBe(before)
    // Well apart, it's written again.
    spreadTo(30)
    expect(names.layOutGameNames()).toHaveLength(2)
    expect(writtenCities()).toEqual(['Los Angeles', 'San Diego'])
  })

  it("hides a city's dot whole where a game's venue on screen is near enough for its pin to touch it, showing it once clear", () => {
    const { map, written, emit, dotShown, spreadTo } = mapWithCityNames()
    const names = addPlaceNames(map, () => builtInTheme, cityLabelSettings)
    // The Rose Bowl, about 15 km from the middle of Los Angeles.
    const roseBowl = { id: 'rose-bowl', venue: { longitude: -118.1675, latitude: 34.1613 } } as PlacedGame
    names.showGames([roseBowl])
    written(['Los Angeles'])
    emit('idle')
    // Zoomed out, the venue's pin is on the dot: hidden.
    spreadTo(10)
    names.layOutGameNames()
    emit('idle')
    expect(dotShown('Los Angeles')).toBe(false)
    // Zoomed in, the venue's pin is well clear: shown.
    spreadTo(200)
    names.layOutGameNames()
    emit('idle')
    expect(dotShown('Los Angeles')).toBe(true)
  })

  it('names cities at every zoom, as score cards show at every zoom', () => {
    for (const layer of placeNameLayers(base, builtInTheme).filter((l) => l.id.startsWith('city_names'))) {
      expect(layer.minzoom, layer.id).toBeUndefined()
      expect(layer.maxzoom, layer.id).toBeUndefined()
    }
  })
})
