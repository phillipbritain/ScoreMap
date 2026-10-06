import type { Map as MapLibreMap } from 'maplibre-gl'

const rad = Math.PI / 180

/**
 * A soft, even blue halo around the globe. MapLibre's own atmosphere is lit from one side and its
 * colour can't be set, so this draws a circle the size of the globe behind the map canvas and gives
 * it a blue glow. Returns a function that removes it.
 */
export function addGlobeGlow(map: MapLibreMap): () => void {
  const container = map.getContainer()
  const glow = document.createElement('div')
  glow.className = 'globe-glow'
  // Before the canvas, so the globe draws over it and only the halo shows.
  container.insertBefore(glow, container.firstChild)

  const place = () => {
    const radius = onScreenRadius(map)
    const centre = map.project(map.getCenter())
    const blur = Math.min(radius * 0.12, 60)
    const spread = Math.min(radius * 0.04, 20)
    const outerBlur = Math.min(radius * 0.35, 160)
    const outerSpread = Math.min(radius * 0.08, 40)
    Object.assign(glow.style, {
      width: `${2 * radius}px`,
      height: `${2 * radius}px`,
      left: `${centre.x - radius}px`,
      top: `${centre.y - radius}px`,
      boxShadow: `0 0 ${blur}px ${spread}px rgb(110 168 255 / 0.55), 0 0 ${outerBlur}px ${outerSpread}px rgb(60 120 255 / 0.25)`,
    })
  }
  map.on('move', place)
  map.on('resize', place)
  // Also once the map settles: the globe projection is only switched on after the style loads,
  // and sizes taken before that are the flat map's.
  map.on('idle', place)
  place()
  return () => {
    map.off('move', place)
    map.off('resize', place)
    map.off('idle', place)
    glow.remove()
  }
}

/**
 * The globe's radius on screen, in pixels. MapLibre doesn't expose it, so this projects points along
 * great circles out from the centre: the farthest any of them lands from the centre is the globe's edge.
 */
function onScreenRadius(map: MapLibreMap): number {
  const centre = map.getCenter()
  const origin = map.project(centre)
  const lat1 = centre.lat * rad
  const lng1 = centre.lng * rad
  let radius = 0
  for (const bearing of [0, 90, 180, 270]) {
    const b = bearing * rad
    for (let degrees = 30; degrees <= 120; degrees += 1) {
      const d = degrees * rad
      const lat2 = Math.asin(Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(b))
      const lng2 = lng1 + Math.atan2(Math.sin(b) * Math.sin(d) * Math.cos(lat1), Math.cos(d) - Math.sin(lat1) * Math.sin(lat2))
      const point = map.project([lng2 / rad, lat2 / rad])
      radius = Math.max(radius, Math.hypot(point.x - origin.x, point.y - origin.y))
    }
  }
  return radius
}
