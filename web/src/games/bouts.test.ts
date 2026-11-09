import { describe, expect, it } from 'vitest'
import type { BoutStatus, GameBout, GameBouts } from './game'
import { boutLine, shownBout } from './bouts'

const side = (name: string, winner = false) => ({ name, shortName: name, flagUrl: null, record: null, winner })

const bout = (id: string, status: BoutStatus, more: Partial<GameBout> = {}): GameBout => ({
  id,
  first: side(`${id} first`),
  second: side(`${id} second`),
  weightClass: 'Lightweight',
  scheduledRounds: 3,
  status,
  round: null,
  clock: null,
  method: null,
  ...more,
})

const card = (...bouts: GameBout[]): GameBouts => ({ kind: 'bouts', bouts })

describe('shownBout', () => {
  it('is the bout on now', () => {
    expect(shownBout(card(bout('main', 'Upcoming'), bout('co-main', 'Live', { round: 2 }), bout('opener', 'Final'))).id).toBe('co-main')
  })

  it('is the main event before the card starts, between bouts and once it is over', () => {
    expect(shownBout(card(bout('main', 'Upcoming'), bout('opener', 'Upcoming'))).id).toBe('main')
    expect(shownBout(card(bout('main', 'Upcoming'), bout('opener', 'Final'))).id).toBe('main')
    expect(shownBout(card(bout('main', 'Final'), bout('opener', 'Final'))).id).toBe('main')
  })
})

describe('boutLine', () => {
  it('gives the round of a bout on now', () => {
    expect(boutLine(bout('main', 'Live', { round: 2, clock: '3:12' }))).toBe('R2')
  })

  it('gives how a finished bout was won, with the round and time of a stoppage', () => {
    expect(boutLine(bout('main', 'Final', { round: 2, clock: '3:38', method: 'KO/TKO' }))).toBe('KO/TKO · R2 3:38')
    expect(boutLine(bout('main', 'Final', { round: 1, clock: '2:51', method: 'Submission' }))).toBe('Submission · R1 2:51')
    expect(boutLine(bout('main', 'Final', { round: 3, clock: '5:00', method: 'Decision' }))).toBe('Decision')
  })

  it('says a finished bout with no winner had none, and one with no method is over', () => {
    expect(boutLine(bout('main', 'Final', { round: 3 }))).toBe('No winner')
    expect(boutLine(bout('main', 'Final', { round: 3, first: side('A', true) }))).toBe('Final')
  })

  it('gives nothing for a bout still to come, and says one called off is', () => {
    expect(boutLine(bout('main', 'Upcoming'))).toBe('')
    expect(boutLine(bout('main', 'Disrupted'))).toBe('Called off')
  })
})
