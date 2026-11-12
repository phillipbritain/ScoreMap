import { describe, expect, it } from 'vitest'
import { cardComingDuration, cardComings, comingOpacity } from './cardComings'

describe('cardComings', () => {
  it('brings in no card for the games first shown, the board as ScoreMap opened on it', () => {
    const comings = cardComings()
    expect(comings.showGames(['a', 'b'])).toEqual({ gone: [], back: [] })
    expect(comings.cardPlaced('a', 0)).toBe(false)
    expect(comings.coming('a')).toBeUndefined()
  })

  it('brings in the card of a game arriving on the board, or shown again by the viewer', () => {
    const comings = cardComings()
    comings.showGames(['a'])
    comings.showGames(['a', 'b'])
    expect(comings.cardPlaced('a', 100)).toBe(false)
    expect(comings.cardPlaced('b', 100)).toBe(true)
    expect(comings.coming('b')).toEqual({ in: true, at: 100 })
  })

  it('brings in a card only once, so a card placed again (say, after a pan) just appears', () => {
    const comings = cardComings()
    comings.showGames(['a'])
    comings.showGames(['a', 'b'])
    comings.cardPlaced('b', 0)
    comings.over(cardComingDuration)
    expect(comings.cardPlaced('b', 1000)).toBe(false)
  })

  it('brings in no card for an arrival out of view when the pins were read: it appears later as cards do', () => {
    const comings = cardComings()
    comings.showGames(['a'])
    comings.showGames(['a', 'b'])
    comings.pinsRead()
    expect(comings.cardPlaced('b', 0)).toBe(false)
  })

  it('waits for the pins to be read with the arrivals in them, however many times the games are shown first', () => {
    const comings = cardComings()
    comings.showGames(['a'])
    comings.showGames(['a', 'b'])
    comings.showGames(['a', 'b'])
    expect(comings.cardPlaced('b', 0)).toBe(true)
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
    expect(comings.cardPlaced('b', 0)).toBe(false)
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

  it('gives back a game shown again while its card is going out, whose new card comes in', () => {
    const comings = cardComings()
    comings.showGames(['a', 'b'])
    comings.showGames(['a'])
    comings.goOut('b', 0)
    expect(comings.showGames(['a', 'b'])).toEqual({ gone: [], back: ['b'] })
    expect(comings.over(cardComingDuration).wentOut).toEqual([])
    expect(comings.cardPlaced('b', 10)).toBe(true)
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
