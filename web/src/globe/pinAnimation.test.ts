import { describe, expect, it } from 'vitest'
import type { Game } from '../games/game'
import type { GameChangeKind } from '../games/gameChange'
import { pinAnimation } from './pinAnimation'

const game = { id: '401' } as Game

const animationFor = (kind: GameChangeKind) => pinAnimation({ kind, game })

describe('pinAnimation', () => {
  it('celebrates a score change', () => {
    expect(animationFor('ScoreChanged')).toBe('score')
  })

  it('announces a game starting', () => {
    expect(animationFor('Started')).toBe('start')
  })

  it('marks a game finishing with its own, calmer animation', () => {
    expect(animationFor('Finished')).toBe('finish')
  })

  it('does not animate clock, period or other updates', () => {
    expect(animationFor('Updated')).toBeNull()
  })

  it('does not animate a pin appearing or leaving', () => {
    expect(animationFor('Added')).toBeNull()
    expect(animationFor('Removed')).toBeNull()
  })
})
