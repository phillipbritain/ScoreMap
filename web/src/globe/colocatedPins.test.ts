import type { Feature, Point } from 'geojson'
import { describe, expect, it } from 'vitest'
import { fanOutColocated, colocatedSeparationMetres } from './colocatedPins'

const pin = (gameId: string, coordinates: [number, number]): Feature<Point, { gameId: string }> => ({
  type: 'Feature',
  id: gameId,
  geometry: { type: 'Point', coordinates },
  properties: { gameId },
})

const arrowhead: [number, number] = [-94.4839, 39.0489]

/** Rough ground distance in metres, good enough over a few kilometres. */
function metresBetween([lng1, lat1]: number[], [lng2, lat2]: number[]): number {
  const metresPerDegree = 111_320
  const dx = (lng2 - lng1) * metresPerDegree * Math.cos((((lat1 + lat2) / 2) * Math.PI) / 180)
  const dy = (lat2 - lat1) * metresPerDegree
  return Math.hypot(dx, dy)
}

const at = (features: Feature<Point, { gameId: string }>[], gameId: string) =>
  features.find((f) => f.properties.gameId === gameId)!.geometry.coordinates

describe('fanOutColocated', () => {
  it('leaves a pin alone at its venue', () => {
    expect(fanOutColocated([pin('401', arrowhead)])).toEqual([pin('401', arrowhead)])
  })

  it('leaves pins at different venues where they are', () => {
    const pins = [pin('401', arrowhead), pin('402', [-75.17, 39.9])]

    expect(fanOutColocated(pins)).toEqual(pins)
  })

  it('spreads games at the same venue far enough apart to be reached one by one', () => {
    const spread = fanOutColocated([pin('401', arrowhead), pin('402', arrowhead), pin('403', arrowhead)])

    for (const [a, b] of [
      ['401', '402'],
      ['401', '403'],
      ['402', '403'],
    ]) {
      expect(metresBetween(at(spread, a), at(spread, b))).toBeGreaterThanOrEqual(colocatedSeparationMetres * 0.99)
    }
  })

  it('keeps the spread games close around their venue', () => {
    const spread = fanOutColocated([pin('401', arrowhead), pin('402', arrowhead)])

    for (const f of spread) expect(metresBetween(f.geometry.coordinates, arrowhead)).toBeLessThan(colocatedSeparationMetres)
  })

  it('gives each game the same place whatever order the games come in', () => {
    const forwards = fanOutColocated([pin('401', arrowhead), pin('402', arrowhead)])
    const backwards = fanOutColocated([pin('402', arrowhead), pin('401', arrowhead)])

    expect(at(backwards, '401')).toEqual(at(forwards, '401'))
    expect(at(backwards, '402')).toEqual(at(forwards, '402'))
  })

  it('spreads games placed at the last-resort 0,0 too', () => {
    const spread = fanOutColocated([pin('1', [0, 0]), pin('2', [0, 0])])

    expect(at(spread, '1')).not.toEqual(at(spread, '2'))
  })
})
