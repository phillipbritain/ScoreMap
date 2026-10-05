import type { Feature, Point } from 'geojson'
import { cardPins } from './cardPins'

/** A cluster on screen that might hold the game. */
export interface ClusterCandidate {
  clusterId: number
  lngLat: [number, number]
}

/**
 * Where a game's animation plays: on its own pin, or on the cluster it's in. Which cluster holds
 * the game can only be found by asking the map for each cluster's games, so this lists the
 * clusters to ask, nearest the game's venue (and so most likely to hold it) first.
 */
export type AnimationTarget =
  | { kind: 'pin'; lngLat: [number, number] }
  | { kind: 'cluster'; candidates: ClusterCandidate[] }

/**
 * Picks where to animate a game from the features queried from the pin source.
 * Null when there is nothing on screen that could show it.
 */
export function animationTarget(
  gameId: string,
  venue: [number, number],
  features: readonly Feature<Point>[],
): AnimationTarget | null {
  const pin = cardPins(features).find((p) => p.gameId === gameId)
  if (pin) return { kind: 'pin', lngLat: pin.lngLat }

  const clusters = new Map<number, ClusterCandidate>()
  for (const { geometry, properties } of features) {
    const clusterId: unknown = properties?.cluster_id
    if (!properties?.cluster || typeof clusterId !== 'number' || clusters.has(clusterId)) continue
    const [lng, lat] = geometry.coordinates
    clusters.set(clusterId, { clusterId, lngLat: [lng, lat] })
  }
  if (clusters.size === 0) return null

  const candidates = [...clusters.values()].sort((a, b) => angle(venue, a.lngLat) - angle(venue, b.lngLat))
  return { kind: 'cluster', candidates }
}

/** The angle between two points as seen from the globe's centre, in radians. */
function angle([lng1, lat1]: [number, number], [lng2, lat2]: [number, number]): number {
  const a = unit(lng1, lat1)
  const b = unit(lng2, lat2)
  const dot = a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
  return Math.acos(Math.min(1, Math.max(-1, dot)))
}

function unit(lng: number, lat: number): [number, number, number] {
  const λ = (lng * Math.PI) / 180
  const φ = (lat * Math.PI) / 180
  return [Math.cos(φ) * Math.cos(λ), Math.cos(φ) * Math.sin(λ), Math.sin(φ)]
}
