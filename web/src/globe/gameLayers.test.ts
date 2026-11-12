import { describe, expect, it } from 'vitest'
import { builtInTheme } from '../theme/builtInTheme'
import { gameLayers } from './gameLayers'

const layers = () => {
  const { belowNames, belowGameNames, onTop } = gameLayers(builtInTheme, null)
  return [...belowNames, ...belowGameNames, ...onTop]
}

describe('gameLayers', () => {
  it('leaves no layer to switch by MapLibre’s zoom, which changes as the globe turns', () => {
    for (const layer of layers()) {
      expect(layer.minzoom, layer.id).toBeUndefined()
      expect(layer.maxzoom, layer.id).toBeUndefined()
      expect(layer.layout?.visibility, layer.id).toBeUndefined()
    }
  })
})
