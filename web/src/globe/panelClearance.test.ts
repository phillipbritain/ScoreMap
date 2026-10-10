import { describe, expect, it } from 'vitest'
import { liftClearOf, panelGap } from './panelClearance'

// A panel across the bottom of an 800 × 600 globe, from y 460 down, inset from the sides.
const panel = { left: 100, top: 460, right: 700, bottom: 590 }

/** A pin's box, its bottom at y, 20 wide around x. */
const pinAt = (x: number, y: number) => ({ left: x - 10, top: y - 20, right: x + 10, bottom: y })

describe('liftClearOf', () => {
  it('leaves a pin well above the panel where it is', () => {
    expect(liftClearOf(pinAt(400, 300), panel)).toBe(0)
  })

  it('lifts a pin under the panel just far enough to leave a gap above it', () => {
    expect(liftClearOf(pinAt(400, 500), panel)).toBe(500 - 460 + panelGap)
  })

  it('lifts a pin only partly under the panel, or just above it within the gap', () => {
    expect(liftClearOf(pinAt(400, 465), panel)).toBe(465 - 460 + panelGap)
    expect(liftClearOf(pinAt(400, 458), panel)).toBe(458 - 460 + panelGap)
  })

  it('leaves a pin beside the panel where it is', () => {
    expect(liftClearOf(pinAt(50, 500), panel)).toBe(0)
    expect(liftClearOf(pinAt(750, 500), panel)).toBe(0)
  })

  it('lifts a pin that overlaps the panel’s side', () => {
    expect(liftClearOf(pinAt(95, 500), panel)).toBe(500 - 460 + panelGap)
  })

  it('leaves the pin where it is with no panel', () => {
    expect(liftClearOf(pinAt(400, 500), null)).toBe(0)
  })
})
