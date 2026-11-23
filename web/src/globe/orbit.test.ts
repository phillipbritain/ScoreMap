import { describe, expect, it } from 'vitest'
import { nextOrbitStop } from './orbit'

const newYork = { longitude: -74, latitude: 41 }
const toronto = { longitude: -79, latitude: 44 }
const london = { longitude: 0, latitude: 51 }
const mumbai = { longitude: 73, latitude: 19 }

describe('nextOrbitStop', () => {
  it('starts with the nearest event and takes in nearby venues at the same stop', () => {
    const venues = [mumbai, london, toronto, newYork]
    expect(nextOrbitStop(venues, newYork, [])).toBe(newYork)
    expect(nextOrbitStop(venues, newYork, [newYork])).toBe(london)
    expect(nextOrbitStop(venues, london, [newYork, london])).toBe(mumbai)
  })

  it('takes the short way across the antimeridian when choosing the nearest venue', () => {
    const center = { longitude: 178, latitude: 0 }
    const across = { longitude: -177, latitude: 0 }
    const west = { longitude: 161, latitude: 0 }
    expect(nextOrbitStop([west, across], center, [])).toBe(across)
  })

  it('waits when there are no events or they are all in the current region', () => {
    expect(nextOrbitStop([], newYork, [])).toBeUndefined()
    expect(nextOrbitStop([newYork, toronto], newYork, [newYork])).toBeUndefined()
  })
})
