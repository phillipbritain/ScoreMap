import { describe, expect, it } from 'vitest'
import { closesOnRelease, downwardSpeed, panelOffset, pressMove } from './swipeClose'

describe('pressMove', () => {
  it('is still a tap within a few pixels', () => {
    expect(pressMove(0, 0)).toBe('tap')
    expect(pressMove(5, 8)).toBe('tap')
  })

  it('is a drag once it moves down further than across', () => {
    expect(pressMove(0, 9)).toBe('drag')
    expect(pressMove(6, 12)).toBe('drag')
  })

  it('is not a drag when it goes sideways or up first', () => {
    expect(pressMove(12, 6)).toBe('not-a-drag')
    expect(pressMove(-12, 6)).toBe('not-a-drag')
    expect(pressMove(0, -12)).toBe('not-a-drag')
  })
})

describe('panelOffset', () => {
  it('follows a drag down all the way', () => {
    expect(panelOffset(120)).toBe(120)
  })

  it('gives only a little to a drag up', () => {
    expect(panelOffset(-100)).toBeCloseTo(-15)
  })
})

describe('downwardSpeed', () => {
  it('is how fast the last moves went down', () => {
    expect(downwardSpeed([{ y: 0, t: 0 }, { y: 50, t: 50 }, { y: 100, t: 100 }])).toBe(1)
  })

  it('leaves out moves from long before the last', () => {
    expect(downwardSpeed([{ y: 0, t: 0 }, { y: 200, t: 1000 }, { y: 200, t: 1100 }])).toBe(0)
  })

  it('is 0 with nothing to measure', () => {
    expect(downwardSpeed([])).toBe(0)
    expect(downwardSpeed([{ y: 10, t: 5 }])).toBe(0)
  })
})

describe('closesOnRelease', () => {
  const height = 240

  it('closes past 30% of the panel', () => {
    expect(closesOnRelease(80, 0, height)).toBe(true)
  })

  it('springs back short of it, let go slowly', () => {
    expect(closesOnRelease(60, 0.2, height)).toBe(false)
  })

  it('closes on a flick down however short', () => {
    expect(closesOnRelease(20, 0.8, height)).toBe(true)
  })

  it('springs back from a flick within a tap', () => {
    expect(closesOnRelease(5, 2, height)).toBe(false)
  })

  it('springs back when let go moving up', () => {
    expect(closesOnRelease(60, -1, height)).toBe(false)
  })
})
