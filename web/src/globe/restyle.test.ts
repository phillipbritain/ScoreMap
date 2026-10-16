import type { LayerSpecification } from 'maplibre-gl'
import { describe, expect, it } from 'vitest'
import { builtInTheme } from '../theme/builtInTheme'
import { themeWith } from '../theme/testTheme'
import type { Theme } from '../theme/theme'
import { gameLayers } from './gameLayers'
import { layerChanges } from './restyle'

const layersIn = (theme: Theme): LayerSpecification[] => {
  const { belowNames, onTop } = gameLayers(theme, null)
  return [...belowNames, ...onTop]
}

describe('layerChanges', () => {
  it('finds nothing to change between a theme and itself', () => {
    expect(layerChanges(layersIn(builtInTheme), layersIn(builtInTheme))).toEqual([])
  })

  it('sets just the properties a change of theme changes, on each layer that has them', () => {
    const wider = themeWith((json) => (json.components.Cluster.outlineWidth = 3))
    expect(layerChanges(layersIn(builtInTheme), layersIn(wider))).toEqual([
      { layer: 'pin-clusters', kind: 'paint', property: 'circle-stroke-width', value: 3 },
      { layer: 'outer-pin-clusters', kind: 'paint', property: 'circle-stroke-width', value: 3 },
      { layer: 'venue-clusters', kind: 'paint', property: 'circle-stroke-width', value: 3 },
      // A card cluster's outline is inside its size.
      { layer: 'card-clusters', kind: 'paint', property: 'circle-radius', value: 10 },
      { layer: 'card-clusters', kind: 'paint', property: 'circle-stroke-width', value: 3 },
    ])
  })

  it('sets a layout property too, such as a cluster count’s font', () => {
    const bolder = themeWith((json) => (json.components.Cluster.count.font = 'Open Sans Extra Bold'))
    const changes = layerChanges(layersIn(builtInTheme), layersIn(bolder))
    expect(changes).toContainEqual({
      layer: 'card-cluster-counts',
      kind: 'layout',
      property: 'text-font',
      value: ['Open Sans Extra Bold'],
    })
    expect(changes.every((change) => change.kind === 'layout' && change.property === 'text-font')).toBe(true)
  })

  it('sets a property the new look leaves out back to its default', () => {
    const before: LayerSpecification[] = [{ id: 'a', type: 'background', paint: { 'background-opacity': 0.5 } }]
    const after: LayerSpecification[] = [{ id: 'a', type: 'background', paint: {} }]
    expect(layerChanges(before, after)).toEqual([{ layer: 'a', kind: 'paint', property: 'background-opacity', value: undefined }])
  })

  it('leaves out layers not in both looks', () => {
    const before: LayerSpecification[] = [{ id: 'a', type: 'background', paint: { 'background-color': '#000000' } }]
    const after: LayerSpecification[] = [{ id: 'b', type: 'background', paint: { 'background-color': '#ffffff' } }]
    expect(layerChanges(before, after)).toEqual([])
  })
})
