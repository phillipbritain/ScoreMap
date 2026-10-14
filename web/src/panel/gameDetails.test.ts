import { describe, expect, it } from 'vitest'
import type { GameSituation, KeyEvent } from '../games/game'
import { hasBases, keyEventName, keyEventsSummary, oddsLine, situationLine } from './gameDetails'

const nothing: GameSituation = {
  lastPlay: null,
  downAndDistance: null,
  possession: null,
  balls: null,
  strikes: null,
  outs: null,
  onFirst: false,
  onSecond: false,
  onThird: false,
}

describe('situationLine', () => {
  it('gives football the down and distance and who has the ball', () => {
    expect(situationLine({ ...nothing, downAndDistance: '2nd & 7 at OSU 34', possession: 'OSU' })).toBe(
      '2nd & 7 at OSU 34 · OSU ball',
    )
  })

  it('gives baseball the count and the outs', () => {
    expect(situationLine({ ...nothing, balls: 2, strikes: 1, outs: 1 })).toBe('2-1 · 1 out')
    expect(situationLine({ ...nothing, balls: 0, strikes: 0, outs: 0 })).toBe('0-0 · 0 outs')
  })

  it('is null where only the last play is known', () => {
    expect(situationLine({ ...nothing, lastPlay: 'Defensive rebound' })).toBeNull()
  })
})

describe('hasBases', () => {
  it('is true only for baseball, which counts outs', () => {
    expect(hasBases({ ...nothing, outs: 0 })).toBe(true)
    expect(hasBases({ ...nothing, downAndDistance: '1st & 10 at KC 25' })).toBe(false)
  })
})

describe('oddsLine', () => {
  it('gives the line and the total', () => {
    expect(oddsLine({ line: 'SEA -2.5', overUnder: 40.5, bookmaker: 'DraftKings' })).toBe('SEA -2.5 · O/U 40.5')
  })

  it('gives whichever half there is', () => {
    expect(oddsLine({ line: null, overUnder: 6.5, bookmaker: null })).toBe('O/U 6.5')
    expect(oddsLine({ line: 'EVEN', overUnder: null, bookmaker: null })).toBe('EVEN')
    expect(oddsLine({ line: null, overUnder: null, bookmaker: null })).toBeNull()
  })
})

describe('key events', () => {
  const goal: KeyEvent = { kind: 'Goal', team: 'ARS', player: 'Declan Rice', clock: "38'" }

  it('marks penalties and own goals', () => {
    expect(keyEventName(goal)).toBe('Declan Rice')
    expect(keyEventName({ ...goal, kind: 'PenaltyGoal' })).toBe('Declan Rice (pen)')
    expect(keyEventName({ ...goal, kind: 'OwnGoal' })).toBe('Declan Rice (og)')
    expect(keyEventName({ ...goal, kind: 'YellowCard', player: null })).toBe('Unknown player')
  })

  it('sums them up in one line', () => {
    expect(keyEventsSummary([goal, { kind: 'YellowCard', team: 'WHU', player: 'Lucas Paquetá', clock: "58'" }])).toBe(
      "38' Goal Declan Rice (ARS), 58' Yellow card Lucas Paquetá (WHU)",
    )
  })
})
