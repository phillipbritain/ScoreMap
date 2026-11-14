// PROTOTYPE, throw away: which games get score cards zoomed out. Switched by ?reachProto= and the
// floating bar (CardReachPrototypeBar), on a local run only. Not for main.
//   A: today, cards within 40° of the view's center at every zoom.
//   B: the reach shrinks zoomed out, to 15° at the furthest out, back to 40° 1.5 zoom levels in.
//   C: a zoom limit, no cards at all further out than a zoom level short of the start zoom.
import type { Map as MapLibreMap } from 'maplibre-gl'
import './cardReachPrototype.css'

export interface ReachVariant {
  key: string
  name: string
}

export const reachVariants: readonly ReachVariant[] = [
  { key: 'A', name: 'Today: 40° at every zoom' },
  { key: 'B', name: 'Reach shrinks zoomed out' },
  { key: 'C', name: 'No cards until zoomed in' },
]

let current = reachVariants[0]
const listeners = new Set<() => void>()

export const reachVariant = (): ReachVariant => (import.meta.env.DEV ? current : reachVariants[0])

export function onReachPrototypeChange(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** The app's map in a dev run (see layoutTrace). */
const devMap = (): MapLibreMap | undefined => (window as unknown as { scoremap?: { map: MapLibreMap } }).scoremap?.map

/** Switches to a variant, in the URL too, and turns the globe a hair so cards and pins are worked out again. */
export function setReachVariant(key: string): void {
  current = reachVariants.find((variant) => variant.key === key) ?? reachVariants[0]
  const url = new URL(window.location.href)
  url.searchParams.set('reachProto', current.key)
  window.history.replaceState(window.history.state, '', url)
  const map = devMap()
  if (map) {
    const { lng, lat } = map.getCenter()
    map.jumpTo({ center: [lng + 1e-6, lat] })
  }
  for (const listener of listeners) listener()
}

if (import.meta.env.DEV && typeof window !== 'undefined') {
  const key = new URL(window.location.href).searchParams.get('reachProto')
  if (key) current = reachVariants.find((variant) => variant.key === key) ?? current
}

/** How far from the view's center a venue can be and still have a card, in degrees, under the variant now. */
export function prototypeCardRadius(today: number): number {
  const map = import.meta.env.DEV ? devMap() : undefined
  if (!map || current.key === 'A') return today
  // The zoom measured at the equator (see zoomAtEquator), and how far in it is from the furthest out.
  const atEquator = map.getZoom() - Math.log2(Math.cos((map.getCenter().lat * Math.PI) / 180))
  const pastFurthestOut = atEquator - map.getMinZoom()
  if (current.key === 'B') {
    const t = Math.max(0, Math.min(1, pastFurthestOut / 1.5))
    return 15 + (today - 15) * t
  }
  // C: the start zoom fitted to the window (see fittedZoomSettings), less a zoom level, as the old card zoom (3) was.
  const shorter = Math.min(window.innerWidth, window.innerHeight)
  const startZoom = 4 + (shorter < 800 ? Math.log2(shorter / 800) : 0)
  return atEquator >= startZoom - 1 ? today : -1
}
