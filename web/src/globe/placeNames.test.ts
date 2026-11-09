import { createExpression, type ExpressionSpecification } from '@maplibre/maplibre-gl-style-spec'
import type { GeoJSONSource, Map as MapLibreMap, StyleSpecification, SymbolLayerSpecification } from 'maplibre-gl'
import type { FeatureCollection } from 'geojson'
import { describe, expect, it } from 'vitest'
import type { PlacedGame } from '../games/placedGames'
import { builtInTheme } from '../theme/builtInTheme'
import { globeFonts } from '../theme/globeFonts'
import type { Theme } from '../theme/theme'
import { cityLabelSettings } from './cityLabels'
import { addPlaceNames, cityNameLook, clusterClearOffset, placeNameLayers } from './placeNames'
import { cardZoom, fittedZoomSettings, zoomSettings } from './zoomLevels'

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
    for (const id of ['city_names', 'city_names_game', 'city_names_card']) {
      for (const zoom of zooms) {
        expect(cityNameLook(zoom, builtInTheme).size, `${id} at ${zoom}`).toBeCloseTo(atZoom(layout(id)['text-size'], zoom), 6)
      }
    }
  })

  it("predicts how far below its dot the map writes a city's name, at every zoom", () => {
    for (const zoom of zooms) {
      const look = cityNameLook(zoom, builtInTheme)
      // The first place tried: below the dot, this many ems down.
      const [, [firstAnchor, [, ems]]] = layout('city_names')['text-variable-anchor-offset'] as ['literal', [string, number[]]]
      expect(firstAnchor).toBe('top')
      expect(look.offset, `at ${zoom}`).toBeCloseTo(ems * look.size, 6)
    }
  })

  it('moves a name far enough from its dot to clear the widest cluster on it, at the smallest size names are written', () => {
    // The widest cluster reaches 17.5 pixels (16 and an outline of 1.5), its footprint a pixel further, and a
    // city name's outline 2 more: 20.5 pixels, at the built-in theme's smallest city size, 12 pixels.
    const smallest = cityNameLook(0, builtInTheme).size
    expect(smallest).toBe(12)
    expect(clusterClearOffset(builtInTheme) * smallest).toBeGreaterThanOrEqual(20.5)
    expect(clusterClearOffset(builtInTheme) * smallest).toBeLessThan(20.5 + 0.12)
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
    expect(layout('city_names_card', theme)['text-font']).toEqual(['Metropolis Light'])
    expect(cityNameLook(5, theme).font).toMatch(/^normal 300 [\d.]+px "Metropolis", sans-serif$/)
  })
})

describe('addPlaceNames', () => {
  // A map with just the city name source, keeping the features last given to it.
  function mapWithCityNames() {
    let features: FeatureCollection | null = null
    let given = 0
    const source = { setData: (data: FeatureCollection) => ((features = data), given++) } as unknown as GeoJSONSource
    const map = { getSource: () => source, on: () => map, off: () => map } as unknown as MapLibreMap
    const gameCities = () => features!.features.filter((f) => f.properties!.game).map((f) => f.properties!.name as string)
    const cardCities = () => features!.features.filter((f) => f.properties!.card).map((f) => f.properties!.name as string)
    return { map, gameCities, cardCities, given: () => given }
  }
  // Everglades City, about 100 km from Miami.
  const evergladesGame = { venue: { longitude: -81.3851, latitude: 25.8573 } } as PlacedGame

  it('names the shown games afresh by new settings', () => {
    const { map, gameCities } = mapWithCityNames()
    const names = addPlaceNames(map, () => builtInTheme, { ...cityLabelSettings, gameCityKm: 50 })
    names.showGames([evergladesGame])
    expect(gameCities()).toEqual([])

    names.setSettings({ ...cityLabelSettings, gameCityKm: 150 })
    expect(gameCities()).toEqual(['Miami'])
  })

  it('keeps a game’s city whole near the horizon while a game it names has a score card', () => {
    const { map, gameCities } = mapWithCityNames()
    const names = addPlaceNames(map, () => builtInTheme, { ...cityLabelSettings, gameCityKm: 150 })
    names.showGames([evergladesGame])
    expect(gameCities()).toEqual(['Miami'])
    const miami = 0
    // The game within the card radius of the center of the view (over Texas), and far out of it (over Tokyo).
    expect(names.namesACard(miami, { longitude: -99, latitude: 31 })).toBe(true)
    expect(names.namesACard(miami, { longitude: 139.7, latitude: 35.7 })).toBe(false)
    // A Big city with no game near names no card.
    expect(names.namesACard(1, { longitude: -99, latitude: 31 })).toBe(false)
  })

  it("marks a game's city as naming a score card while the card is on screen, giving the cities again only when that changes", () => {
    const { map, gameCities, cardCities, given } = mapWithCityNames()
    const names = addPlaceNames(map, () => builtInTheme, { ...cityLabelSettings, gameCityKm: 150 })
    // In Chicago, far from Miami.
    const chicagoGame = { venue: { longitude: -87.6359, latitude: 41.8789 } } as PlacedGame
    names.showGames([evergladesGame, chicagoGame])
    expect(gameCities()).toEqual(expect.arrayContaining(['Miami', 'Chicago']))
    expect(cardCities()).toEqual([])

    names.showCards([evergladesGame.venue])
    expect(cardCities()).toEqual(['Miami'])
    const before = given()
    names.showCards([evergladesGame.venue])
    expect(given()).toBe(before)

    // Its card gone into a card cluster, Chicago's showing.
    names.showCards([chicagoGame.venue])
    expect(cardCities()).toEqual(['Chicago'])
    names.showCards([])
    expect(cardCities()).toEqual([])
  })

  it('names cities from the zoom score cards show from, a phone’s further out than a laptop’s', () => {
    const ranges = new Map<string, [number, number]>()
    const map = {
      getSource: () => undefined,
      getLayer: () => ({}),
      setLayerZoomRange: (id: string, min: number, max: number) => ranges.set(id, [min, max]),
      getZoom: () => 2.5,
      on: () => map,
      off: () => map,
    } as unknown as MapLibreMap
    // The style names them from a laptop's.
    expect(placeNameLayers(base, builtInTheme).find((l) => l.id === 'city_names')?.minzoom).toBe(cardZoom)
    const names = addPlaceNames(map, () => builtInTheme, cityLabelSettings, cardZoom)
    expect(names.nameBoxes()).toEqual([])

    const phone = fittedZoomSettings(zoomSettings, { width: 390, height: 844 }).cardZoom
    names.showFrom(phone)
    expect([...ranges.values()]).toEqual([
      [phone, 24],
      [phone, 24],
      [phone, 24],
    ])
    expect(phone).toBeLessThan(2.5)
  })
})
