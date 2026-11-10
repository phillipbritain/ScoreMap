import { describe, expect, it } from 'vitest'
import type { LoadingStage } from './globeMap'
import { globeSettling, maxSettlingFrames, type GlobeSettling } from './globeSettling'

function settlingTold(): { settling: GlobeSettling; stages: LoadingStage[]; readies: () => number } {
  const stages: LoadingStage[] = []
  let readies = 0
  const settling = globeSettling({ onStage: (stage) => stages.push(stage), onReady: () => readies++ })
  return { settling, stages, readies: () => readies }
}

/** Card syncs that keep changing, with the pins loaded, until one doesn't ask for a frame. */
function syncsUntilNoFrame(settling: GlobeSettling): number {
  let syncs = 0
  while (settling.cardsSynced({ changed: true, pinsLoaded: true }) === 'askForFrame') syncs++
  return syncs
}

describe('globeSettling', () => {
  describe('the budget', () => {
    it(`asks for a frame after each of ${maxSettlingFrames} changing syncs, then gives up on the next`, () => {
      const { settling } = settlingTold()
      for (let sync = 1; sync <= maxSettlingFrames; sync++) {
        expect(settling.cardsSynced({ changed: true, pinsLoaded: true })).toBe('askForFrame')
      }
      expect(settling.cardsSynced({ changed: true, pinsLoaded: true })).toBe('giveUp')
    })

    it('asks for nothing after a sync that changed nothing, and starts the count afresh', () => {
      const { settling } = settlingTold()
      settling.cardsSynced({ changed: true, pinsLoaded: true })
      settling.cardsSynced({ changed: true, pinsLoaded: true })
      expect(settling.cardsSynced({ changed: false, pinsLoaded: true })).toBe('nothing')
      expect(syncsUntilNoFrame(settling)).toBe(maxSettlingFrames)
    })

    it('spends no frames while the pins are loading, and gives the layout its full count once they have', () => {
      const { settling } = settlingTold()
      settling.cardsSynced({ changed: true, pinsLoaded: true })
      settling.cardsSynced({ changed: true, pinsLoaded: true })
      expect(settling.cardsSynced({ changed: true, pinsLoaded: false })).toBe('nothing')
      expect(syncsUntilNoFrame(settling)).toBe(maxSettlingFrames)
    })

    it('keeps asking for nothing once given up, the cards unsteady', () => {
      const { settling } = settlingTold()
      syncsUntilNoFrame(settling)
      expect(settling.cardsSteady()).toBe(false)
    })
  })

  describe('holding the layout', () => {
    it('holds nothing until the cards have given up', () => {
      const { settling } = settlingTold()
      expect(settling.holdsLayout({ everyCardLaidOut: true })).toBe(false)
    })

    it('holds the layout once given up, with every card already laid out', () => {
      const { settling } = settlingTold()
      syncsUntilNoFrame(settling)
      expect(settling.holdsLayout({ everyCardLaidOut: true })).toBe(true)
      expect(settling.holdsLayout({ everyCardLaidOut: true })).toBe(true)
    })

    it('settles afresh, with the full count, for a card not yet laid out', () => {
      const { settling } = settlingTold()
      syncsUntilNoFrame(settling)
      expect(settling.holdsLayout({ everyCardLaidOut: false })).toBe(false)
      expect(settling.holdsLayout({ everyCardLaidOut: true })).toBe(false)
      expect(syncsUntilNoFrame(settling)).toBe(maxSettlingFrames)
    })

    it('settles afresh, with the full count, after a change from outside', () => {
      const { settling } = settlingTold()
      settling.cardsSynced({ changed: true, pinsLoaded: true })
      settling.settleAfresh()
      expect(syncsUntilNoFrame(settling)).toBe(maxSettlingFrames)
      settling.settleAfresh()
      expect(settling.holdsLayout({ everyCardLaidOut: true })).toBe(false)
      expect(syncsUntilNoFrame(settling)).toBe(maxSettlingFrames)
    })
  })

  describe('settled', () => {
    /** Settled: the cards steady, the map idle with the pins loaded. */
    function settledNow(): GlobeSettling {
      const { settling } = settlingTold()
      settling.cardsSynced({ changed: false, pinsLoaded: true })
      settling.wentIdle({ pinsLoaded: true })
      return settling
    }

    it('is settled once the cards are steady and the map idle with the pins loaded', () => {
      expect(settledNow().settled({ pinsLoaded: true })).toBe(true)
    })

    it('is not settled before the cards have synced', () => {
      const { settling } = settlingTold()
      settling.wentIdle({ pinsLoaded: true })
      expect(settling.cardsSteady()).toBe(false)
      expect(settling.settled({ pinsLoaded: true })).toBe(false)
    })

    it('is not settled while the pins are loading', () => {
      expect(settledNow().settled({ pinsLoaded: false })).toBe(false)
    })

    it('is not settled after a frame drawn, until the map goes idle again', () => {
      const settling = settledNow()
      settling.frameDrawn()
      expect(settling.settled({ pinsLoaded: true })).toBe(false)
      settling.wentIdle({ pinsLoaded: true })
      expect(settling.settled({ pinsLoaded: true })).toBe(true)
    })

    it('is not settled after a change, until the map goes idle again', () => {
      const settling = settledNow()
      settling.unsettle()
      expect(settling.settled({ pinsLoaded: true })).toBe(false)
      settling.wentIdle({ pinsLoaded: true })
      expect(settling.settled({ pinsLoaded: true })).toBe(true)
    })

    it('is not settled after a card sync that changed something, though the map is idle', () => {
      const settling = settledNow()
      settling.cardsSynced({ changed: true, pinsLoaded: true })
      expect(settling.settled({ pinsLoaded: true })).toBe(false)
    })

    it('is not settled having given up, though the map goes idle', () => {
      const { settling } = settlingTold()
      syncsUntilNoFrame(settling)
      settling.wentIdle({ pinsLoaded: true })
      expect(settling.settled({ pinsLoaded: true })).toBe(false)
    })
  })

  describe('the stage', () => {
    it('waits for games, then draws them, then is ready once settled', () => {
      const { settling, stages, readies } = settlingTold()
      expect(settling.stage()).toBe('waitingForGames')
      settling.gamesArrived()
      expect(settling.stage()).toBe('drawing')
      settling.cardsSynced({ changed: false, pinsLoaded: true })
      settling.wentIdle({ pinsLoaded: true })
      expect(settling.stage()).toBe('ready')
      expect(stages).toEqual(['drawing', 'ready'])
      expect(readies()).toBe(1)
    })

    it('is not ready on going idle with no games, however still', () => {
      const { settling, stages } = settlingTold()
      settling.cardsSynced({ changed: false, pinsLoaded: true })
      settling.wentIdle({ pinsLoaded: true })
      expect(settling.stage()).toBe('waitingForGames')
      expect(stages).toEqual([])
    })

    it('is ready only on going idle, not on games arriving while still', () => {
      const { settling } = settlingTold()
      settling.cardsSynced({ changed: false, pinsLoaded: true })
      settling.wentIdle({ pinsLoaded: true })
      settling.gamesArrived()
      expect(settling.stage()).toBe('drawing')
      settling.wentIdle({ pinsLoaded: true })
      expect(settling.stage()).toBe('ready')
    })

    it('is not ready on going idle with the pins loading, or the cards unsteady', () => {
      const { settling } = settlingTold()
      settling.gamesArrived()
      settling.wentIdle({ pinsLoaded: true })
      expect(settling.stage()).toBe('drawing')
      settling.cardsSynced({ changed: false, pinsLoaded: true })
      settling.wentIdle({ pinsLoaded: false })
      expect(settling.stage()).toBe('drawing')
    })

    it('is ready despite the cards giving up, the map idle', () => {
      const { settling, readies } = settlingTold()
      settling.gamesArrived()
      syncsUntilNoFrame(settling)
      settling.wentIdle({ pinsLoaded: true })
      expect(settling.stage()).toBe('ready')
      expect(settling.settled({ pinsLoaded: true })).toBe(false)
      expect(readies()).toBe(1)
    })

    it('stays ready for good, told once, through changes, frames and more games', () => {
      const { settling, stages, readies } = settlingTold()
      settling.gamesArrived()
      settling.cardsSynced({ changed: false, pinsLoaded: true })
      settling.wentIdle({ pinsLoaded: true })
      settling.unsettle()
      settling.settleAfresh()
      settling.frameDrawn()
      settling.cardsSynced({ changed: true, pinsLoaded: false })
      settling.gamesArrived()
      settling.cardsSynced({ changed: false, pinsLoaded: true })
      settling.wentIdle({ pinsLoaded: true })
      expect(settling.stage()).toBe('ready')
      expect(stages).toEqual(['drawing', 'ready'])
      expect(readies()).toBe(1)
    })

    it('tells a style error before games, and stays at it', () => {
      const { settling, stages } = settlingTold()
      settling.styleFailed()
      expect(settling.stage()).toBe('styleError')
      settling.gamesArrived()
      expect(settling.stage()).toBe('styleError')
      expect(stages).toEqual(['styleError'])
    })

    it('tells games arriving once, however many arrive', () => {
      const { settling, stages } = settlingTold()
      settling.gamesArrived()
      settling.gamesArrived()
      expect(stages).toEqual(['drawing'])
    })
  })
})
