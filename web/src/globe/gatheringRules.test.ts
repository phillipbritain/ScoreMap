import { describe, expect, it } from 'vitest'
import type { CardLayout, Gathering, ScreenCard, Showing } from './cardLayout'
import { gatheringRulesBroken } from './gatheringRules'

const card = (gameId: string): ScreenCard => ({ gameId, status: 'Live', venueX: 0, venueY: 0, width: 100, height: 60 })
const onScreen: Showing = { as: 'card', offset: { dx: 0, dy: -16 }, moved: false, trail: { x1: 0, y1: -16, x2: 0, y2: 0 } }
const laidOut = (showing: Record<string, Showing>, gatherings: Gathering[]): Pick<CardLayout, 'shows' | 'gatherings'> => ({
  shows: (gameId) => showing[gameId] ?? { as: 'notLaidOut' },
  gatherings: () => gatherings,
})
const broken = (showing: Record<string, Showing>, gatherings: Gathering[], cards = ['a', 'b']) =>
  [...gatheringRulesBroken(laidOut(showing, gatherings), cards.map(card))]

describe('gatheringRulesBroken', () => {
  const dotOf = (gameId: string): Gathering => ({ kind: 'venueDot', trails: [gameId], noRoom: [], at: { venueOf: gameId } })

  it('breaks none for cards ending at their own venue dots', () => {
    expect(broken({ a: onScreen, b: onScreen }, [dotOf('a'), dotOf('b')])).toEqual([])
  })

  it('breaks "every game shows once" for a game missing, or shown twice', () => {
    expect(broken({ a: onScreen }, [dotOf('a')])).toEqual(['every game shows once'])
    const twice: Gathering = { kind: 'smallPin', trails: [], noRoom: ['b'], at: { venueOf: 'b' } }
    expect(broken({ a: onScreen, b: { as: 'smallPin' } }, [dotOf('a'), twice, twice])).toEqual(['every game shows once'])
  })

  it('breaks "no card cluster of one game"', () => {
    const one: Gathering = { kind: 'cardCluster', trails: [], noRoom: ['b'], at: { venueOf: 'b' } }
    expect(broken({ a: onScreen, b: { as: 'inCardCluster', cardCluster: ['b'] } }, [dotOf('a'), one])).toEqual(['no card cluster of one game'])
  })

  it("breaks \"trails end where they should\" for a trail ending at another game's dot, nowhere, or a card cluster that doesn't count it", () => {
    expect(broken({ a: onScreen, b: onScreen }, [dotOf('a'), { ...dotOf('b'), at: { venueOf: 'a' } }])).toEqual(['trails end where they should'])
    expect(broken({ a: onScreen, b: onScreen }, [dotOf('a')])).toEqual(['trails end where they should'])
    const cluster: Gathering = { kind: 'cardCluster', trails: ['a'], noRoom: ['b'], at: { x: 0, y: 0 } }
    expect(broken({ a: onScreen, b: { as: 'inCardCluster', cardCluster: ['a', 'b'] } }, [cluster])).toEqual(['trails end where they should'])
  })
})
