import { describe, expect, it } from 'vitest'
import type { Game, GameStatus } from '../games/game'
import { pinAnimation } from './pinAnimation'

function game(status: GameStatus, sport = 'Football', clutchTime = false): Game {
  return { sport, status, clutchTime } as Game
}

// What changed is the server's to judge (GameChanges, with its tests); the globe only picks the look.
describe('pinAnimation', () => {
  it('celebrates a score change', () => {
    expect(pinAnimation('ScoreChanged', game('Live'))).toBe('score')
  })

  it('announces a game starting', () => {
    expect(pinAnimation('Started', game('Live'))).toBe('start')
  })

  it('plays nothing as a game finishes', () => {
    expect(pinAnimation('Finished', game('Final'))).toBeNull()
  })

  it('celebrates a basketball score change only in clutch time, judged on the score after the basket', () => {
    expect(pinAnimation('ScoreChanged', game('Live', 'Basketball', true))).toBe('score')
    expect(pinAnimation('ScoreChanged', game('Live', 'Basketball', false))).toBeNull()
  })

  it('keeps basketball starting animated outside clutch time', () => {
    expect(pinAnimation('Started', game('Live', 'Basketball'))).toBe('start')
  })
})
