import type { LayerSpecification, Map as MapLibreMap } from 'maplibre-gl'

/** One property of a map layer to set, to restyle the layer from one theme's look to another's. */
export interface LayerChange {
  layer: string
  kind: 'paint' | 'layout'
  property: string
  /** Undefined where the new look leaves the property out, which sets it back to MapLibre's default. */
  value: unknown
}

/**
 * The paint and layout properties that differ between layers as made in one theme and as made in
 * another, by layer id: what to set on the map to restyle it in place. Only layers in both count.
 * Compared as made, not as the map has them now, so what the globe sets as it runs (the selected
 * pin's filter, say) is left alone unless the theme changes it.
 */
export function layerChanges(before: readonly LayerSpecification[], after: readonly LayerSpecification[]): LayerChange[] {
  const was = new Map(before.map((layer) => [layer.id, layer]))
  return after.flatMap((layer) => {
    const old = was.get(layer.id)
    if (!old) return []
    return (['paint', 'layout'] as const).flatMap((kind) => {
      const from = propertiesOf(old, kind)
      const to = propertiesOf(layer, kind)
      return [...new Set([...Object.keys(from), ...Object.keys(to)])]
        .filter((property) => JSON.stringify(from[property]) !== JSON.stringify(to[property]))
        .map((property): LayerChange => ({ layer: layer.id, kind, property, value: to[property] }))
    })
  })
}

function propertiesOf(layer: LayerSpecification, kind: 'paint' | 'layout'): Readonly<Record<string, unknown>> {
  return ((layer as Partial<Record<'paint' | 'layout', object>>)[kind] ?? {}) as Readonly<Record<string, unknown>>
}

type PaintArguments = Parameters<MapLibreMap['setPaintProperty']>
type LayoutArguments = Parameters<MapLibreMap['setLayoutProperty']>

/** Sets each change on the map, on the layers it has. */
export function applyLayerChanges(map: MapLibreMap, changes: readonly LayerChange[]): void {
  for (const { layer, kind, property, value } of changes) {
    if (!map.getLayer(layer)) continue
    if (kind === 'paint') map.setPaintProperty(layer, property as PaintArguments[1], value as PaintArguments[2])
    else map.setLayoutProperty(layer, property as LayoutArguments[1], value as LayoutArguments[2])
  }
}
