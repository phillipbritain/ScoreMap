import { describe, expect, it } from 'vitest'
import { kmApart, ringAround } from './geo'

describe('ringAround', () => {
  it('rings a point at the distance given, closed', () => {
    const miami = { longitude: -80.2261, latitude: 25.7896 }
    const ring = ringAround(miami, 150)
    for (const point of ring) expect(kmApart(miami, point)).toBeCloseTo(150, 6)
    expect(ring.at(-1)).toEqual(ring[0])
  })

  it('keeps a ring across the antimeridian in one piece', () => {
    const ring = ringAround({ longitude: 179.9, latitude: -16.5 }, 100)
    expect(Math.max(...ring.map((p) => p.longitude)) - Math.min(...ring.map((p) => p.longitude))).toBeLessThan(2)
  })
})
