import type { Feature, Point } from 'geojson'
import { cardPins } from './cardPins'
import { degreesApart, type GlobePoint } from './geo'

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

  const fromVenue = (c: ClusterCandidate) => degreesApart(at(venue), at(c.lngLat))
  const candidates = [...clusters.values()].sort((a, b) => fromVenue(a) - fromVenue(b))
  return { kind: 'cluster', candidates }
}

function at([longitude, latitude]: [number, number]): GlobePoint {
  return { longitude, latitude }
}
