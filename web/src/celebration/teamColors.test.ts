import { describe, expect, it } from 'vitest'
import { strongColors } from './teamColors'

/** Pixels, RGBA, from [r, g, b, a] each repeated `times`. */
const pixels = (...runs: [number[], number][]) => new Uint8ClampedArray(runs.flatMap(([rgba, times]) => Array.from({ length: times }, () => rgba).flat()))

describe("a logo's strongest colors", () => {
  it('gives the most common colors first', () => {
    const colors = strongColors(pixels([[200, 16, 46, 255], 3], [[19, 41, 75, 255], 5]))
    expect(colors).toEqual(['rgb(24 40 72)', 'rgb(200 24 40)'])
  })

  it('leaves out white, black and gray, a logo’s outlines and background', () => {
    const colors = strongColors(pixels([[255, 255, 255, 255], 9], [[0, 0, 0, 255], 9], [[128, 128, 128, 255], 9], [[200, 16, 46, 255], 1]))
    expect(colors).toEqual(['rgb(200 24 40)'])
  })

  it('leaves out pixels mostly see-through', () => {
    expect(strongColors(pixels([[200, 16, 46, 100], 9]))).toEqual([])
  })

  it('counts alike colors as one', () => {
    const colors = strongColors(pixels([[200, 16, 46, 255], 2], [[202, 18, 44, 255], 2], [[19, 41, 75, 255], 3]))
    expect(colors[0]).toBe('rgb(200 24 40)')
  })

  it('gives at most as many as asked', () => {
    const colors = strongColors(pixels([[200, 16, 46, 255], 3], [[19, 41, 75, 255], 2], [[250, 180, 20, 255], 1]), 2)
    expect(colors).toHaveLength(2)
  })
})
