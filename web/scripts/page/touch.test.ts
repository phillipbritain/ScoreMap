import { describe, expect, it } from 'vitest'
import { moveEvery, swipeMoves } from './touch.ts'

describe('swipeMoves', () => {
  it('moves the same distance every frame, ending on the end point at the swipe’s time', () => {
    const moves = swipeMoves([100, 600], [0, 160], 500)
    expect(moves).toHaveLength(Math.round(500 / moveEvery))
    expect(moves.at(-1)).toEqual({ x: 100, y: 760, at: 500 })
    const steps = moves.map((move, i) => move.y - (i ? moves[i - 1].y : 600))
    steps.forEach((step) => expect(step).toBeCloseTo(160 / moves.length))
    const gaps = moves.map((move, i) => move.at - (i ? moves[i - 1].at : 0))
    gaps.forEach((gap) => expect(gap).toBeCloseTo(500 / moves.length))
  })

  it('makes a swipe shorter than a frame one move', () => {
    expect(swipeMoves([0, 0], [30, -40], 5)).toEqual([{ x: 30, y: -40, at: 5 }])
  })
})
