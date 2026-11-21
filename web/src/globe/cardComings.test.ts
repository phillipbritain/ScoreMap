import { describe, expect, it } from 'vitest'
import { cardComingDuration, cardComings, comingOpacity } from './cardComings'

describe('cardComings', () => {
  it('brings in a card only once, so a card placed again (say, after a pan) appears', () => {
    const comings = cardComings()
    comings.showGames(['a'])
    comings.showGames(['a', 'b'])
    comings.cardPlaced('b', 0)
    comings.over(cardComingDuration)
    expect(comings.cardPlaced('b', 1000)).toBe('appears')
  })

  it('gives the games gone from the board, finished or hidden by the viewer, for their cards to go out', () => {
    const comings = cardComings()
    comings.showGames(['a', 'b', 'c'])
    expect(comings.showGames(['a'])).toEqual({ gone: ['b', 'c'], back: [] })
    comings.goOut('b', 500)
    expect(comings.coming('b')).toEqual({ in: false, at: 500 })
    expect(comings.coming('c')).toBeUndefined()
  })

  it('forgets an arrival that goes again before getting a card', () => {
    const comings = cardComings()
    comings.showGames(['a'])
    comings.showGames(['a', 'b'])
    comings.showGames(['a'])
    comings.showGames(['a', 'c'])
    expect(comings.cardPlaced('b', 0)).toBe('appears')
  })

  it('says which cards are done coming in and going out, once their time is up', () => {
    const comings = cardComings()
    comings.showGames(['a', 'b'])
    comings.showGames(['a', 'c'])
    comings.cardPlaced('c', 0)
    comings.goOut('b', 100)
    expect(comings.over(cardComingDuration - 1)).toEqual({ cameIn: [], wentOut: [] })
    expect(comings.over(cardComingDuration)).toEqual({ cameIn: ['c'], wentOut: [] })
    expect(comings.over(cardComingDuration + 100)).toEqual({ cameIn: [], wentOut: ['b'] })
    expect(comings.coming('b')).toBeUndefined()
  })

  it('fades in a card come into view, its trail with it', () => {
    const comings = cardComings()
    comings.showGames(['a'])
    comings.cardPlaced('a', 100)
    expect(comings.coming('a')).toEqual({ in: true, at: 100 })
    expect(comings.over(100 + cardComingDuration)).toEqual({ cameIn: ['a'], wentOut: [] })
  })

  it('just shows a card come into view when told it does not fade', () => {
    const comings = cardComings()
    comings.showGames(['a'])
    expect(comings.cardPlaced('a', 100, false)).toBe('appears')
    expect(comings.coming('a')).toBeUndefined()
  })

  it('takes a card going out partway in out from as far in as it got', () => {
    const comings = cardComings()
    comings.showGames([])
    comings.showGames(['a'])
    comings.cardPlaced('a', 0)
    const partway = cardComingDuration * 0.4
    comings.goOut('a', partway)
    expect(comingOpacity(comings.coming('a')!, partway)).toBeCloseTo(0.4)
  })
})

describe('comingOpacity', () => {
  it('fades a card and its trail in from nothing, and out to nothing', () => {
    expect(comingOpacity({ in: true, at: 0 }, 0)).toBe(0)
    expect(comingOpacity({ in: true, at: 0 }, cardComingDuration / 2)).toBe(0.5)
    expect(comingOpacity({ in: true, at: 0 }, cardComingDuration * 2)).toBe(1)
    expect(comingOpacity({ in: false, at: 0 }, 0)).toBe(1)
    expect(comingOpacity({ in: false, at: 0 }, cardComingDuration)).toBe(0)
  })
})
