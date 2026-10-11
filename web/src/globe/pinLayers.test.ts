import type { LayerSpecification, SymbolLayerSpecification } from 'maplibre-gl'
import { describe, expect, it } from 'vitest'
import builtIn from '../theme/builtInTheme.json'
import { resolveTheme, type Theme } from '../theme/theme'
import { cardLayoutLayers } from './cardLayoutLayers'
import { pinClusterLayers } from './pinLayers'

/** The built-in theme, with cluster counts in another font and size. */
function testTheme(): Theme {
  const json = structuredClone(builtIn) as Record<string, any>
  json.settings.fonts.clusterCount = { font: 'Metropolis Semi Bold', size: 'l' }
  json.settings.textSizes.l = 16
  const result = resolveTheme(json)
  if (!result.ok) throw new Error(result.problems.join('\n'))
  return result.theme
}

const countLayout = (layers: readonly LayerSpecification[], id: string) =>
  (layers.find((l) => l.id === id) as SymbolLayerSpecification).layout

describe('cluster counts', () => {
  it("are written in the theme's font and size, on pin clusters and card clusters alike", () => {
    const theme = testTheme()
    for (const layout of [
      countLayout(pinClusterLayers(theme), 'pin-cluster-counts'),
      countLayout(cardLayoutLayers(theme), 'card-cluster-counts'),
    ]) {
      expect(layout).toMatchObject({ 'text-font': ['Metropolis Semi Bold'], 'text-size': 16 })
    }
  })
})
