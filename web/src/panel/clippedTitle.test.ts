import { describe, expect, it } from 'vitest'
import { isClipped } from './clippedTitle'

describe('isClipped', () => {
  const box = { scrollWidth: 100, clientWidth: 100, scrollHeight: 20, clientHeight: 20 }

  it('is false when the text fits its box', () => {
    expect(isClipped(box)).toBe(false)
  })

  it('is true when the text is wider than its box', () => {
    expect(isClipped({ ...box, scrollWidth: 140 })).toBe(true)
  })

  it('is true when the text runs to more lines than its box shows', () => {
    expect(isClipped({ ...box, scrollHeight: 60 })).toBe(true)
  })
})
