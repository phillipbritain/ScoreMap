import { describe, expect, it } from 'vitest'
import stateLines from './stateLines.json'

type Position = [number, number]
const lines = stateLines.features[0].geometry.coordinates as Position[][]

/** Whether some line runs along this meridian (within 0.01°) from one latitude to the other. */
const runsAlong = (longitude: number, from: number, to: number) =>
  lines.some((line) => {
    const on = line.filter(([x]) => Math.abs(x - longitude) < 0.01).map(([, y]) => y)
    return on.length >= 2 && Math.min(...on) <= from + 0.1 && Math.max(...on) >= to - 0.1
  })

describe('the state lines', () => {
  it('include every kind of line Natural Earth sorts US state lines into, such as Colorado–Kansas, a census region bound', () => {
    expect(runsAlong(-102.05, 37, 40)).toBe(true)
  })

  it("keep only the United States' and Canada's", () => {
    // Mexico's states, south of the border (Chihuahua and Durango's line runs through 26°N, 106°W).
    const inMexico = lines.some((line) => line.some(([x, y]) => x > -110 && x < -98 && y > 19 && y < 28))
    expect(inMexico).toBe(false)
  })
})
