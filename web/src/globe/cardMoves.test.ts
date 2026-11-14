import { describe, expect, it } from 'vitest'
import { cardMoveDuration, cardMoveStep, cardMoves, moveLag } from './cardMoves'

const shownAt = (offset: { dx: number; dy: number }, lag: { dx: number; dy: number }) => ({ dx: offset.dx + lag.dx, dy: offset.dy + lag.dy })

describe('cardMoves', () => {
  it('starts a card where it is first laid out', () => {
    const moves = cardMoves()
    expect(moves.placeAt('a', { dx: 40, dy: -10 }, 0)).toBeUndefined()
    expect(moves.move('a', 0)).toBeUndefined()
  })

  it('follows a small step at once, as the globe turning pushes a card along', () => {
    const moves = cardMoves()
    moves.placeAt('a', { dx: 0, dy: -10 }, 0)
    expect(moves.placeAt('a', { dx: cardMoveStep, dy: -10 }, 16)).toBeUndefined()
  })

  it('glides a card moved further from where it was, landing where it is laid out', () => {
    const moves = cardMoves()
    moves.placeAt('a', { dx: 0, dy: -10 }, 0)
    const move = moves.placeAt('a', { dx: 100, dy: -10 }, 1000)!
    expect(shownAt({ dx: 100, dy: -10 }, moveLag(move, 1000))).toEqual({ dx: 0, dy: -10 })
    const halfway = moveLag(move, 1000 + cardMoveDuration / 2)
    expect(halfway.dx).toBeLessThan(0)
    expect(halfway.dx).toBeGreaterThan(-100)
    const landed = moveLag(move, 1000 + cardMoveDuration)
    expect(Math.hypot(landed.dx, landed.dy)).toBe(0)
    expect(moves.move('a', 1000 + cardMoveDuration - 1)).toBe(move)
    expect(moves.move('a', 1000 + cardMoveDuration)).toBeUndefined()
  })

  it('glides a card moved again as it glides on from where it is shown, so it never jumps', () => {
    const moves = cardMoves()
    moves.placeAt('a', { dx: 0, dy: 0 }, 0)
    const first = moves.placeAt('a', { dx: 100, dy: 0 }, 0)!
    const then = cardMoveDuration / 3
    const shown = shownAt({ dx: 100, dy: 0 }, moveLag(first, then))
    const second = moves.placeAt('a', { dx: 100, dy: 80 }, then)!
    expect(shownAt({ dx: 100, dy: 80 }, moveLag(second, then))).toEqual(shown)
  })

  it('keeps a glide going through the small steps that follow it', () => {
    const moves = cardMoves()
    moves.placeAt('a', { dx: 0, dy: 0 }, 0)
    const move = moves.placeAt('a', { dx: 100, dy: 0 }, 0)
    moves.placeAt('a', { dx: 103, dy: 0 }, 16)
    expect(moves.move('a', 16)).toBe(move)
  })

  it('starts a card shown again where it is laid out, not from where it was before it was hidden', () => {
    const moves = cardMoves()
    moves.placeAt('a', { dx: 0, dy: 0 }, 0)
    moves.forget('a')
    expect(moves.placeAt('a', { dx: 200, dy: 0 }, 100)).toBeUndefined()
    expect(moves.move('a', 100)).toBeUndefined()
  })
})
