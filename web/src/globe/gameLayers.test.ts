import { describe, expect, it } from 'vitest'
import { builtInTheme } from '../theme/builtInTheme'
import { gameLayers } from './gameLayers'
import { outerSmallPinLayer, smallPinLayer } from './pinLayers'
import type { PinSize } from './zoomLevels'

const layersFor = (size: PinSize) => {
  const { belowNames, onTop } = gameLayers(builtInTheme, null, size)
  return [...belowNames, ...onTop]
}
const visibility = (size: PinSize, id: string) => layersFor(size).find((layer) => layer.id === id)?.layout?.visibility

describe('gameLayers', () => {
  it("shows the games' own small pins while small pins show, and the outer games' pins once score cards do", () => {
    expect(visibility('small', smallPinLayer)).toBe('visible')
    expect(visibility('small', outerSmallPinLayer)).toBe('none')
    expect(visibility('card', smallPinLayer)).toBe('none')
    expect(visibility('card', outerSmallPinLayer)).toBe('visible')
  })

  it('leaves no layer to switch by MapLibre’s zoom, which changes as the globe turns', () => {
    for (const size of ['small', 'card'] as const) {
      for (const layer of layersFor(size)) {
        expect(layer.minzoom, layer.id).toBeUndefined()
        expect(layer.maxzoom, layer.id).toBeUndefined()
      }
    }
  })
})
