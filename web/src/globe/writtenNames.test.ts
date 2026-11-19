import { describe, expect, it } from 'vitest'
import { writtenNames, type NameOnScreen } from './writtenNames'

/** A name 100 px wide and 20 high, its box centered at (x, y). */
const name = (key: string, population: number, x: number, y: number): NameOnScreen => ({ key, population, box: { x, y, width: 100, height: 20 } })

const written = (names: NameOnScreen[], before: ReadonlyMap<string, boolean> = new Map()) =>
  [...writtenNames(names, before, 4)].filter(([, shown]) => shown).map(([key]) => key)

describe('writtenNames', () => {
  it('writes names that clear each other, and of two that overlap, the more populous', () => {
    const losAngeles = name('Los Angeles', 12_500_000, 100, 100)
    const sanDiego = name('San Diego', 2_916_000, 110, 110)
    const denver = name('Denver', 2_313_000, 400, 100)
    expect(written([sanDiego, denver, losAngeles])).toEqual(['Los Angeles', 'Denver'])
  })

  it('leaves out a name only a hidden name overlaps', () => {
    const a = name('A', 3, 100, 100)
    const b = name('B', 2, 100, 115)
    const c = name('C', 1, 100, 130)
    // B gives way to A; C overlaps only B, so it's written.
    expect(written([a, b, c])).toEqual(['A', 'C'])
  })

  it('keeps a name written while a more populous one overlaps it by no more than the margin', () => {
    const before = new Map([['San Diego', true]])
    // Boxes 20 high: centers 17 px apart overlap by 3 px.
    expect(written([name('Los Angeles', 2, 100, 100), name('San Diego', 1, 100, 117)], before)).toEqual(['Los Angeles', 'San Diego'])
    // By 5 px, it gives way.
    expect(written([name('Los Angeles', 2, 100, 100), name('San Diego', 1, 100, 115)], before)).toEqual(['Los Angeles'])
  })

  it('writes a hidden name again only once it clears the more populous one by more than the margin', () => {
    const before = new Map([['San Diego', false]])
    // 3 px clear: still hidden.
    expect(written([name('Los Angeles', 2, 100, 100), name('San Diego', 1, 100, 123)], before)).toEqual(['Los Angeles'])
    // 5 px clear: written.
    expect(written([name('Los Angeles', 2, 100, 100), name('San Diego', 1, 100, 125)], before)).toEqual(['Los Angeles', 'San Diego'])
  })

  it('writes a name not seen before whenever it clears the names written', () => {
    expect(written([name('Los Angeles', 2, 100, 100), name('San Diego', 1, 100, 121)])).toEqual(['Los Angeles', 'San Diego'])
    expect(written([name('Los Angeles', 2, 100, 100), name('San Diego', 1, 100, 119)])).toEqual(['Los Angeles'])
  })

  it('stays the same through a pan that moves names a fraction of a pixel each frame back and forth across touching', () => {
    let before: ReadonlyMap<string, boolean> = new Map()
    const seen = new Set<string>()
    for (const gap of [0.2, -0.1, 0.1, -0.2, 0.3, -0.3, 0]) {
      const now = writtenNames([name('Los Angeles', 2, 100, 100), name('San Diego', 1, 100, 120 + gap)], before, 4)
      seen.add(JSON.stringify([...now]))
      before = now
    }
    expect(seen.size).toBe(1)
  })
})
