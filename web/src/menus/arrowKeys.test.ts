import { describe, expect, it } from 'vitest'
import { arrowStep } from './arrowKeys'

describe('arrowStep', () => {
  it('moves down and up one control at a time, stopping at the ends', () => {
    expect(arrowStep('ArrowDown', 0, 3)).toBe(1)
    expect(arrowStep('ArrowDown', 2, 3)).toBe(2)
    expect(arrowStep('ArrowUp', 1, 3)).toBe(0)
    expect(arrowStep('ArrowUp', 0, 3)).toBe(0)
  })

  it('jumps to the first and last with Home and End', () => {
    expect(arrowStep('Home', 2, 3)).toBe(0)
    expect(arrowStep('End', 0, 3)).toBe(2)
  })

  it('comes in at the top going down and at the bottom going up, from outside the controls', () => {
    expect(arrowStep('ArrowDown', -1, 3)).toBe(0)
    expect(arrowStep('ArrowUp', -1, 3)).toBe(2)
  })

  it('moves nothing on other keys, or with no controls', () => {
    expect(arrowStep('Tab', 1, 3)).toBeUndefined()
    expect(arrowStep('ArrowLeft', 1, 3)).toBeUndefined()
    expect(arrowStep('ArrowDown', -1, 0)).toBeUndefined()
  })
})
