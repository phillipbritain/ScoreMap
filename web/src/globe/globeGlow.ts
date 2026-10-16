import type { Map as MapLibreMap } from 'maplibre-gl'
import type { Theme } from '../theme/theme'
import { radians } from './geo'

/** The halo around a globe (see addGlobeGlow). */
export interface GlobeGlow {
  /** Draws it where the globe is now, in the theme as it is now. */
  place(): void
  remove(): void
}

/**
 * A soft, even halo around the globe in the theme's colours: an inner glow close to its edge and a
 * wider, fainter outer one. MapLibre's own atmosphere is lit from one side and its colour can't be
 * set, so this draws a circle the size of the globe, in the globe's surface colour, behind the map
 * canvas and gives it the glow, in the theme `theme` gives each time it's placed.
 */
export function addGlobeGlow(map: MapLibreMap, theme: () => Theme): GlobeGlow {
  const container = map.getContainer()
  const glow = document.createElement('div')
  glow.className = 'globe-glow'
  // Before the canvas, so the globe draws over it and only the halo shows.
  container.insertBefore(glow, container.firstChild)

  // The globe's size on screen changes only with the zoom, the latitude the view is centred on, the
  // map's size and its projection (see idle, below), so it's worked out again only when one of them
  // changes: not as a pan along a parallel goes.
  let measured = { key: '', radius: 0 }
  const radiusNow = () => {
    const canvas = map.getCanvas()
    const key = `${map.getZoom()} ${map.getCenter().lat} ${canvas.width} ${canvas.height} ${map.getProjection()?.type}`
    if (key !== measured.key) measured = { key, radius: onScreenRadius(map) }
    return measured.radius
  }

  const place = () => {
    const globe = theme().components.Globe
    const radius = radiusNow()
    const centre = map.project(map.getCenter())
    // Each glow grows with the globe on screen, up to the theme's most.
    const size = ({ share, max }: { share: number; max: number }) => Math.min(radius * share, max)
    const shadow = ({ color, blur, spread }: Theme['components']['Globe']['halo']['inner']) => `0 0 ${size(blur)}px ${size(spread)}px ${color}`
    Object.assign(glow.style, {
      backgroundColor: globe.surface,
      width: `${2 * radius}px`,
      height: `${2 * radius}px`,
      left: `${centre.x - radius}px`,
      top: `${centre.y - radius}px`,
      boxShadow: `${shadow(globe.halo.inner)}, ${shadow(globe.halo.outer)}`,
    })
  }
  map.on('move', place)
  map.on('resize', place)
  // Also once the map settles: the globe projection is only switched on after the style loads,
  // and sizes taken before that are the flat map's.
  map.on('idle', place)
  place()
  return {
    place,
    remove() {
      map.off('move', place)
      map.off('resize', place)
      map.off('idle', place)
      glow.remove()
    },
  }
}

// How many degrees apart the points first tried along each bearing are (see onScreenRadius).
const coarseStep = 6

/**
 * The globe's radius on screen, in pixels. MapLibre doesn't expose it, so this projects points along
 * great circles out from the centre: the farthest any of them lands from the centre is the globe's edge.
 */
function onScreenRadius(map: MapLibreMap): number {
  const centre = map.getCenter()
  const origin = map.project(centre)
  const lat1 = centre.lat * radians
  const lng1 = centre.lng * radians
  // How far from the centre on screen the point this many degrees out along a bearing lands.
  const along = (b: number, degrees: number) => {
    const d = degrees * radians
    // Kept within ±1: on a pole, rounding can land it just past, where asin gives NaN.
    const sinLat2 = Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(b)
    const lat2 = Math.asin(Math.min(1, Math.max(-1, sinLat2)))
    const lng2 = lng1 + Math.atan2(Math.sin(b) * Math.sin(d) * Math.cos(lat1), Math.cos(d) - Math.sin(lat1) * Math.sin(lat2))
    const point = map.project([lng2 / radians, lat2 / radians])
    return Math.hypot(point.x - origin.x, point.y - origin.y)
  }
  let radius = 0
  for (const bearing of [0, 90, 180, 270]) {
    const b = bearing * radians
    // Every few degrees, then every degree around the farthest of those: it lands farther out up to
    // the edge, then back in.
    let farthest = { degrees: 30, distance: 0 }
    for (let degrees = 30; degrees <= 120; degrees += coarseStep) {
      const distance = along(b, degrees)
      if (distance > farthest.distance) farthest = { degrees, distance }
    }
    radius = Math.max(radius, farthest.distance)
    for (let degrees = Math.max(30, farthest.degrees - coarseStep + 1); degrees <= Math.min(120, farthest.degrees + coarseStep - 1); degrees += 1) {
      radius = Math.max(radius, along(b, degrees))
    }
  }
  return radius
}
