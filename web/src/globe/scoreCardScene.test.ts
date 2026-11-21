import { describe, expect, it } from 'vitest'
import type { PlacedGame } from '../games/placedGames'
import type { CardPin } from './cardPins'
import { globeSettling, maxSettlingFrames, type GlobeSettling } from './globeSettling'
import { scoreCardScene, type CardsOnPage, type SceneFrame, type ScoreCardScene } from './scoreCardScene'
import type { TrailOnGlobe } from './trailLayer'

const screen = { width: 1000, height: 600 }
/** A flat globe for the scene: a degree is 100 pixels, 0°, 0° in the middle of the screen, and past 90° of longitude behind the globe. */
const venueOf = ([longitude, latitude]: [number, number]) => ({ x: screen.width / 2 + longitude * 100, y: screen.height / 2 - latitude * 100 })

function game(id: string): PlacedGame {
  // All a game's card needs of it here: what it ranks by.
  const side = { rank: null }
  return { id, status: 'Live', hot: false, contest: { kind: 'sides', home: side, away: side } } as unknown as PlacedGame
}

/** The page the scene tells, recording what it's told, and each card's trail as the map would draw it. */
function fakePage() {
  const told: string[] = []
  let trailsShown: TrailOnGlobe[] = []
  /** Whether each card drawn is redrawn, as a card whose clock changes every frame would be. */
  const page = { redraws: false }
  const cardsOnPage: CardsOnPage = {
    place: (gameId) => told.push(`place ${gameId}`),
    comeIn: (gameId) => told.push(`comeIn ${gameId}`),
    appear: (gameId, since) => told.push(`appear ${gameId} ${since}`),
    cameIn: (gameId) => told.push(`cameIn ${gameId}`),
    moveTo: (gameId, lngLat) => told.push(`moveTo ${gameId} ${lngLat.join(',')}`),
    draw: () => page.redraws,
    size: () => ({ width: 80, height: 40 }),
    placeAt: (gameId) => told.push(`placeAt ${gameId}`),
    drawLayout: (cards) => {
      told.push('drawLayout')
      return cards.map(({ gameId, lngLat }) => ({ gameId, color: 'red', venue: lngLat, start: { dx: 0, dy: -10 }, end: lngLat, dot: true }))
    },
    showTrails: (trails) => (trailsShown = trails),
    goOut: (gameId, since, trail, outOfView) => told.push(`goOut ${gameId} ${since} ${trail ? 'withTrail' : 'noTrail'}${outOfView ? ' outOfView' : ''}`),
    dispose: (gameId) => told.push(`dispose ${gameId}`),
    removeGoingOut: (gameId) => told.push(`removeGoingOut ${gameId}`),
  }
  return {
    cardsOnPage,
    page,
    /** What the page was told since it was last asked, in order. */
    told: () => told.splice(0),
    trailsShown: () => trailsShown,
  }
}

function sceneOnPage() {
  const page = fakePage()
  const settling = globeSettling({ onStage: () => {}, onReady: () => {} })
  const clock = { now: 0 }
  const scene = scoreCardScene({ page: page.cardsOnPage, settling, cardCount: 'default', reducedMotion: () => false, now: () => clock.now })
  return { scene, settling, clock, ...page }
}

/** A frame of the map with these pins, or none readable while they load. */
function frame(pins: readonly CardPin[] | null): SceneFrame {
  return {
    pins,
    behindGlobe: ([longitude]) => Math.abs(longitude) > 90,
    onScreen: (lngLat) => {
      const { x, y } = venueOf(lngLat)
      return x >= 0 && y >= 0 && x <= screen.width && y <= screen.height
    },
    venue: venueOf,
    screen: () => screen,
    layoutScene: () => ({ venueGap: 10, names: [], cameraMoving: false, venueSizes: { dot: 5, venueCluster: 5, cardCluster: 20 } }),
  }
}

// Far enough apart that their cards sit over their venues.
const pinsAt: Record<string, [number, number]> = { A: [-3, 0], B: [0, 0], C: [3, 0] }
const pins = (...gameIds: string[]): CardPin[] => gameIds.map((gameId) => ({ gameId, lngLat: pinsAt[gameId] }))

/** Frames until the scene asks for no more, as the map draws them while it does: how many it asked for. */
function framesUntilSettled(scene: ScoreCardScene, framePins: readonly CardPin[]): number {
  let asked = 0
  while (scene.frame(frame(framePins)) === 'askForFrame') asked++
  return asked
}

/** Brings the globe to Ready, as the map going idle after the cards settle does: cards then fade and glide. */
function ready(scene: ScoreCardScene, settling: GlobeSettling, framePins: readonly CardPin[]) {
  settling.gamesArrived()
  framesUntilSettled(scene, framePins)
  settling.wentIdle({ pinsLoaded: true })
  expect(settling.stage()).toBe('ready')
}

describe('scoreCardScene', () => {
  describe('while the pins load', () => {
    it('keeps the cards placed where they are, spending none of the settling budget however many frames the map draws', () => {
      const { scene, page, told } = sceneOnPage()
      scene.showGames([game('A'), game('B')])
      framesUntilSettled(scene, pins('A', 'B'))
      told()

      page.redraws = true
      for (let i = 0; i < maxSettlingFrames * 2; i++) {
        expect(scene.frame(frame(null))).toBe('nothing')
        expect(told().filter((said) => !said.startsWith('moveTo') && !said.startsWith('placeAt') && said !== 'drawLayout')).toEqual([])
      }
      // Each card stays at the venue it had.
      scene.frame(frame(null))
      expect(told().filter((said) => said.startsWith('moveTo'))).toEqual(['moveTo A -3,0', 'moveTo B 0,0'])

      // Readable again, the layout has its full count of frames to settle in.
      expect(framesUntilSettled(scene, pins('A', 'B'))).toBe(maxSettlingFrames)
      expect(scene.frame(frame(pins('A', 'B')))).toBe('held')
    })

    it('places no card for a game shown while they load, until they can be read with it', () => {
      const { scene, told } = sceneOnPage()
      scene.showGames([game('A')])
      framesUntilSettled(scene, pins('A'))
      scene.showGames([game('A'), game('B')])
      told()

      scene.frame(frame(null))
      scene.frame(frame(null))
      expect(told()).not.toContain('place B')
      scene.frame(frame(pins('A', 'B')))
      expect(told()).toEqual(expect.arrayContaining(['place B', 'comeIn B']))
    })
  })

  describe('giving up settling', () => {
    const changesFromOutside: [string, (scene: ScoreCardScene) => void][] = [
      ['the camera moving', (scene) => scene.cameraMoved()],
      ['the camera stopping', (scene) => scene.cameraStopped()],
      ['a selection', (scene) => scene.select('A')],
      ['a restyle', (scene) => scene.restyled()],
      ['new games', (scene) => scene.showGames([game('A'), game('B')])],
      ['a change of card count', (scene) => scene.setCardCount('more')],
    ]

    it.each(changesFromOutside)('holds the layout as last drawn, frame after frame, until %s', (_change, change) => {
      const { scene, page, told } = sceneOnPage()
      scene.showGames([game('A'), game('B')])
      // Cards redrawn every frame never settle: the scene asks for frames up to the budget, then gives up.
      page.redraws = true
      expect(framesUntilSettled(scene, pins('A', 'B'))).toBe(maxSettlingFrames)
      told()

      for (let i = 0; i < 5; i++) {
        expect(scene.frame(frame(pins('A', 'B')))).toBe('held')
        expect(told().filter((said) => said.startsWith('placeAt') || said === 'drawLayout')).toEqual([])
      }

      change(scene)
      expect(scene.frame(frame(pins('A', 'B')))).toBe('askForFrame')
      expect(told()).toContain('drawLayout')
    })

    it('lays out a card new to the layout while holding it, and settles afresh', () => {
      const { scene, page, told } = sceneOnPage()
      scene.showGames([game('A'), game('B'), game('C')])
      page.redraws = true
      framesUntilSettled(scene, pins('A', 'B'))
      expect(scene.frame(frame(pins('A', 'B')))).toBe('held')
      told()

      expect(scene.frame(frame(pins('A', 'B', 'C')))).toBe('askForFrame')
      expect(told()).toEqual(expect.arrayContaining(['place C', 'placeAt C', 'drawLayout']))
    })
  })

  describe('cards coming in and going out', () => {
    it('brings in no card for the games first shown, the board as ScoreMap opened on it, but brings in those arriving later', () => {
      const { scene, told } = sceneOnPage()
      scene.showGames([game('A')])
      scene.frame(frame(pins('A')))
      expect(told()).not.toContain('comeIn A')

      scene.showGames([game('A'), game('B')])
      scene.frame(frame(pins('A', 'B')))
      expect(told()).toContain('comeIn B')
    })

    it('brings in no card for an arrival out of view when the pins were read: it appears later as cards do', () => {
      const { scene, settling, told } = sceneOnPage()
      scene.showGames([game('A')])
      ready(scene, settling, pins('A'))
      scene.showGames([game('A'), game('B')])
      const offScreen: CardPin = { gameId: 'B', lngLat: [20, 0] }
      scene.frame(frame([...pins('A'), offScreen]))
      expect(told()).not.toContain('place B')

      scene.frame(frame(pins('A', 'B')))
      const said = told()
      expect(said).toContain('appear B 0')
      expect(said).not.toContain('comeIn B')
    })

    it('has the card of a game gone from the board go out with its trail, and one back meanwhile replace it and its trail with a new card coming in', () => {
      const { scene, told, trailsShown } = sceneOnPage()
      scene.showGames([game('A'), game('B')])
      framesUntilSettled(scene, pins('A', 'B'))
      told()

      scene.showGames([game('A')])
      expect(told()).toEqual(['goOut B 0 withTrail'])
      expect(trailsShown().filter(({ gameId }) => gameId === 'B')).toEqual([expect.objectContaining({ coming: { in: false, at: 0 } })])
      scene.frame(frame(pins('A')))
      expect(trailsShown().filter(({ gameId }) => gameId === 'B')).toHaveLength(1)
      told()

      scene.showGames([game('A'), game('B')])
      expect(told()).toEqual(['removeGoingOut B'])
      scene.frame(frame(pins('A', 'B')))
      const said = told()
      expect(said.indexOf('place B')).toBeGreaterThanOrEqual(0)
      expect(said).toContain('comeIn B')
      expect(said).not.toContain('removeGoingOut B')
      // One trail for the game: the new card's, coming in.
      expect(trailsShown().filter(({ gameId }) => gameId === 'B')).toEqual([expect.objectContaining({ coming: { in: true, at: 0 } })])

      // Its old card done going out is long gone: the new card is left as it came in.
      scene.comingsOver()
      expect(told()).not.toContain('removeGoingOut B')
    })

    it('fades a card out as its venue leaves the view, and one back in view meanwhile replaces it, fading in from as far as it got', () => {
      const { scene, settling, clock, told, trailsShown } = sceneOnPage()
      scene.showGames([game('A'), game('B')])
      ready(scene, settling, pins('A', 'B'))
      told()

      clock.now = 1000
      scene.frame(frame(pins('A', 'B').map((pin) => (pin.gameId === 'B' ? { ...pin, lngLat: [120, 0] as [number, number] } : pin))))
      expect(told()).toContain('goOut B 0 noTrail outOfView')

      clock.now = 1075
      scene.frame(frame(pins('A', 'B')))
      const said = told()
      expect(said.indexOf('removeGoingOut B')).toBeLessThan(said.indexOf('place B'))
      // A quarter of the way out, it fades in from three quarters in.
      expect(said).toContain('appear B 225')
      expect(trailsShown().filter(({ gameId }) => gameId === 'B')).toHaveLength(1)
    })

    it('just takes off a card with no room, or not yet laid out, as its game goes', () => {
      const { scene, told } = sceneOnPage()
      scene.showGames([game('A'), game('B')])
      scene.showGames([game('A')])
      scene.frame(frame(pins('A')))
      expect(told()).not.toContain('place B')

      scene.showGames([game('A'), game('C')])
      scene.frame(frame(null))
      scene.showGames([game('A')])
      expect(told().some((said) => said.startsWith('goOut'))).toBe(false)
    })
  })
})
