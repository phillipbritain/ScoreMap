import type { FilterSpecification, Map as MapLibreMap } from 'maplibre-gl'
import { degreesApart } from './geo'
import { placeTiles, stateNames } from './globeStyle'

// How often to check, at most: often enough to follow slow spin, rarely enough not to slow it.
const checkEveryMs = 250

/**
 * Shows state names all or none: only while every state name in view fits, clear of every other
 * name, card and pin. Where any would give way, none show, so the map never names some states and
 * not their neighbours. The names are still placed while unseen (see globeStyle), which is how the
 * map tells whether they'd fit; being the last names placed, they never push another name aside.
 * Returns a function that stops it.
 */
export function addStateNameFit(map: MapLibreMap): () => void {
  let shown = false
  let lastCheck = 0
  const check = () => {
    lastCheck = performance.now()
    const show = allStateNamesFit(map)
    if (show === shown || !map.getLayer(stateNames)) return
    shown = show
    map.setPaintProperty(stateNames, 'text-opacity', show ? 1 : 0)
  }
  const checkNowAndThen = () => {
    if (performance.now() - lastCheck >= checkEveryMs) check()
  }
  map.on('render', checkNowAndThen)
  // Once more when the map settles, which the checks along the way may have just missed.
  map.on('idle', check)
  return () => {
    map.off('render', checkNowAndThen)
    map.off('idle', check)
  }
}

/** Whether every state in view has its name placed: none dropped for want of room. */
function allStateNamesFit(map: MapLibreMap): boolean {
  const layer = map.getLayer(stateNames)
  if (!layer) return false
  const zoom = map.getZoom()
  if (zoom < layer.minzoom || zoom >= layer.maxzoom) return false

  const inView = new Set<string | number>()
  const canvas = map.getCanvas()
  const centre = map.getCenter()
  for (const { id, geometry } of map.querySourceFeatures(placeTiles.source, {
    sourceLayer: placeTiles.sourceLayer,
    filter: map.getFilter(stateNames) as FilterSpecification | undefined,
  })) {
    if (id === undefined || inView.has(id) || geometry.type !== 'Point') continue
    const [longitude, latitude] = geometry.coordinates
    // On the near side of the globe; the far side projects onto the screen too.
    if (degreesApart({ longitude: centre.lng, latitude: centre.lat }, { longitude, latitude }) >= 90) continue
    const { x, y } = map.project([longitude, latitude])
    if (x >= 0 && x <= canvas.clientWidth && y >= 0 && y <= canvas.clientHeight) inView.add(id)
  }
  if (inView.size === 0) return false

  const placed = new Set(map.queryRenderedFeatures({ layers: [stateNames] }).map((f) => f.id))
  return [...inView].every((id) => placed.has(id))
}
