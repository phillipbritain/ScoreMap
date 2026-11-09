import type { LayerSpecification } from 'maplibre-gl'
import { describe, expect, it } from 'vitest'
import { builtInTheme } from '../theme/builtInTheme'
import { themeWith } from '../theme/testTheme'
import type { Theme } from '../theme/theme'
import { gameLayers } from './gameLayers'
import { layerChanges } from './restyle'

const layersIn = (theme: Theme): LayerSpecification[] => {
  const { belowNames, belowGameNames, onTop } = gameLayers(theme, null, 'small')
  return [...belowNames, ...belowGameNames, ...onTop]
}

describe('layerChanges', () => {
  it('finds nothing to change between a theme and itself', () => {
    expect(layerChanges(layersIn(builtInTheme), layersIn(builtInTheme))).toEqual([])
  })

  it('sets just the properties a change of theme changes, on each layer that has them', () => {
    const wider = themeWith((json) => (json.components.Cluster.outlineWidth = 3))
    // A third of the way up a flame 12 tall below the top of a pin cluster of a few, some and many, 3 wider.
    const flameOffsets = ['step', ['get', 'point_count'], ['literal', [0, -10]], 5, ['literal', [0, -12]], 15, ['literal', [0, -15]]]
    // Pin and venue clusters' footprints as far across as they reach (14, 16 and 19), with a pixel each side, over the footprint image's 32.
    const footprintSizes = (count: string) => ['step', ['get', count], 30, 5, 34, 15, 40]
    const footprintSize = (across: unknown) => ({ kind: 'layout', property: 'icon-size', value: ['/', across, 32] })
    expect(layerChanges(layersIn(builtInTheme), layersIn(wider))).toEqual([
      { layer: 'pin-clusters', kind: 'paint', property: 'circle-stroke-width', value: 3 },
      // A hot pin cluster's flame stands on its outline.
      { layer: 'pin-cluster-flames', kind: 'layout', property: 'icon-offset', value: flameOffsets },
      { layer: 'outer-pin-clusters', kind: 'paint', property: 'circle-stroke-width', value: 3 },
      { layer: 'outer-pin-cluster-flames', kind: 'layout', property: 'icon-offset', value: flameOffsets },
      { layer: 'venue-clusters', kind: 'paint', property: 'circle-stroke-width', value: 3 },
      // A card cluster's outline is inside its size.
      { layer: 'card-clusters', kind: 'paint', property: 'circle-radius', value: 10 },
      { layer: 'card-clusters', kind: 'paint', property: 'circle-stroke-width', value: 3 },
      // A card cluster's footprint is as wide as it is, outline and all (13, as its outline is inside).
      { layer: 'card-cluster-footprints', ...footprintSize(['case', ['==', ['get', 'kind'], 'cardCluster'], 28, footprintSizes('count')]) },
      { layer: 'pin-cluster-footprints', ...footprintSize(footprintSizes('point_count')) },
      { layer: 'outer-pin-cluster-footprints', ...footprintSize(footprintSizes('point_count')) },
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
