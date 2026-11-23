import type { Map as MapLibreMap, MapMovementEvent } from 'maplibre-gl'
import { degreesApart, type GlobePoint } from './geo'
import { furthestOutZoom } from './zoomLevels'

// One stop can take in nearby venues. Leave time to read the cards before moving on.
const regionRadius = 25
const dwell = 6_000
const degreesPerSecond = 4

/** The nearest venue in a region this pass hasn't visited. */
export function nextOrbitStop(
  venues: Iterable<GlobePoint>,
  center: GlobePoint,
  visited: readonly GlobePoint[],
): GlobePoint | undefined {
  let nearest: GlobePoint | undefined
  let bestDistance = Infinity
  for (const venue of venues) {
    const distance = degreesApart(center, venue)
    if (distance >= bestDistance || visited.some((stop) => degreesApart(stop, venue) < regionRadius)) continue
    nearest = venue
    bestDistance = distance
  }
  return nearest
}

/** Pans between regions with events, taking the current board into account at every stop. */
export class Orbit {
  private readonly map: MapLibreMap
  private readonly venues: () => Iterable<GlobePoint>
  private readonly onChange: (active: boolean) => void
  private active = false
  private visited: GlobePoint[] = []
  private timer: ReturnType<typeof setTimeout> | undefined

  constructor(
    map: MapLibreMap,
    venues: () => readonly GlobePoint[],
    onChange: (active: boolean) => void,
  ) {
    this.map = map
    this.venues = venues
    this.onChange = onChange
    map.on('movestart', this.steered)
    map.on('moveend', this.arrived)
  }

  start(): void {
    if (this.active) return
    this.map.stop()
    this.active = true
    this.onChange(true)
    this.advance()
  }

  stop(): void {
    if (!this.active) return
    this.end()
    this.map.stop()
  }

  destroy(): void {
    this.active = false
    clearTimeout(this.timer)
    this.map.off('movestart', this.steered)
    this.map.off('moveend', this.arrived)
  }

  // A keyboard move has already taken over from Orbit by the time MapLibre reports it.
  private readonly steered = (event: MapMovementEvent) => {
    if (this.active && event.originalEvent) this.end()
  }

  private end(): void {
    this.active = false
    this.visited = []
    clearTimeout(this.timer)
    this.onChange(false)
  }

  private readonly arrived = (event: MapMovementEvent & { orbit?: Orbit }) => {
    if (this.active && event.orbit === this) this.wait()
  }

  private wait(): void {
    this.timer = setTimeout(() => this.advance(), dwell)
  }

  private advance(): void {
    const { lng, lat } = this.map.getCenter()
    const center = { longitude: lng, latitude: lat }
    const venues = this.venues()
    let stop = nextOrbitStop(venues, center, this.visited)
    if (!stop && this.visited.length) {
      // Begin a new pass, without immediately revisiting the region already on screen.
      this.visited = [center]
      stop = nextOrbitStop(venues, center, this.visited)
    }
    if (stop) this.visited.push(stop)
    const target = stop ?? center
    const zoom = furthestOutZoom(target.latitude, this.map.getMinZoom())
    const distance = degreesApart(center, target)
    if (distance < 0.01 && Math.abs(this.map.getZoom() - zoom) < 0.01) {
      this.wait()
      return
    }
    this.map.easeTo(
      { center: [target.longitude, target.latitude], zoom, duration: Math.max(1_200, distance * 1_000 / degreesPerSecond) },
      { orbit: this },
    )
  }
}
