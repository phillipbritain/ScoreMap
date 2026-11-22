import type { PlacedGame } from '../games/placedGames'
import type { CardCount } from '../settings/viewerSettings'
import { cardComings, type CardComing } from './cardComings'
import { cardMoves, type CardMove } from './cardMoves'
import type { CardPin } from './cardPins'
import { cardRank, nearCenter } from './cardRank'
import { mostCards, cardLayout, type CardLayout, type LayoutScene, type ScreenCard, type ScreenOffset, type Showing } from './cardLayout'
import type { AfterCardSync, GlobeSettling } from './globeSettling'
import type { LaidOutFrame } from './layoutTrace'
import type { TrailOnGlobe } from './trailLayer'

/** A score card laid out this frame, with its venue on the globe, for the map to draw its layout from (see cardLayoutLayers). */
export interface CardLaidOut extends ScreenCard {
  lngLat: [number, number]
}

/**
 * What a frame of the map shows the score card scene (see ScoreCardScene.frame): the pins, and where
 * their venues are on screen. Worked out from the map by ScoreCardMarkers.
 */
export interface SceneFrame {
  /** The pins read from the pin source, or null while it reloads and can't be read. */
  pins: readonly CardPin[] | null
  /** Whether a venue is behind the globe now. */
  behindGlobe(lngLat: [number, number]): boolean
  /** Whether a venue is on screen now (on either side of the globe). */
  onScreen(lngLat: [number, number]): boolean
  /** Where a venue is on screen now. */
  venue(lngLat: [number, number]): { x: number; y: number }
  /** The map's size on screen, asked only when the cards are laid out. */
  screen(): { width: number; height: number }
  /** What else the cards are laid out in, asked only when they're laid out (see LayoutScene). */
  layoutScene(): Pick<LayoutScene, 'venueGap' | 'names' | 'cameraMoving' | 'venueSizes'>
}

/**
 * The score cards on the page and the map, which the scene tells what to show (see ScoreCardScene):
 * ScoreCardMarkers, which applies it to the page's elements and to MapLibre. Each card is named by its
 * game; a card going out is a card of its own, apart from any new card for the same game.
 */
export interface CardsOnPage {
  /** Puts a new card for a game on the globe, at its venue. */
  place(gameId: string, lngLat: [number, number]): void
  /** Starts a card just placed coming in, its game having just arrived on the board. */
  comeIn(gameId: string): void
  /** Fades a card just placed in, `since` milliseconds in, as it's come into view. */
  appear(gameId: string, since: number): void
  /** Leaves a card as it is, now it's come in or appeared. */
  cameIn(gameId: string): void
  /** Moves a card to its venue, if it has moved. */
  moveTo(gameId: string, lngLat: [number, number]): void
  /** Draws a card for its game as it is now, if anything it's drawn from has changed: true if it was redrawn. */
  draw(gameId: string, game: PlacedGame): boolean
  /** A card's size on screen, as last measured. */
  size(gameId: string): { width: number; height: number }
  /** Puts a card where the layout has it, gliding there if `glide` is given, in a card cluster or not. */
  placeAt(gameId: string, at: { offset: ScreenOffset; moved: boolean; glide?: CardMove; inCardCluster: boolean }): void
  /** Gives the map a layout of the cards (see cardLayoutLayers): gives the moved cards' trails, or null if the map can't draw it yet. */
  drawLayout(cards: readonly CardLaidOut[], layout: CardLayout, moving: boolean): TrailOnGlobe[] | null
  /** Shows these trails, each fading or gliding with its card. */
  showTrails(trails: TrailOnGlobe[]): void
  /** Starts a card going out, `since` milliseconds in, drawn with its trail until it's removed; then it's a card going out. */
  goOut(gameId: string, since: number, trail: TrailOnGlobe | undefined, outOfView: boolean): void
  /** Takes a card off the globe at once. */
  dispose(gameId: string): void
  /** Takes a card going out off the globe. */
  removeGoingOut(gameId: string): void
}

/**
 * The score cards' scene: which games have score cards, and each frame, what becomes of them (see
 * frame). A plain object, holding no page element or map: told what happens (games, selection, card
 * count, the camera, a restyle, each frame of the map), it decides, and has the cards on the page
 * (see CardsOnPage) follow. It reports to the globe's settling, which says when to ask for a frame.
 */
export interface ScoreCardScene {
  /** Keeps pinned cards ahead of ordinary cards, retaining the last position of each. */
  setPinned(gameIds: readonly string[]): void
  reveal(gameIds: readonly string[]): void
  /**
   * Shows these games: a game gone from the board has its card, if on screen, go out, and one back
   * while its card goes out has the old card go at once, for a new one to come in. The cards settle afresh.
   */
  showGames(games: readonly PlacedGame[]): void
  /** The selected game, whose card has a place on screen wherever its venue is. The cards settle afresh. */
  select(gameId: string | null): void
  /** Shows as many cards at once as this card count allows (see mostCards), laid out afresh. False if it was that count already. */
  setCardCount(count: CardCount): boolean
  /** The cards were restyled, so they're laid out afresh: held where they were, they would overlap. */
  restyled(): void
  /** The camera has moved: the cards settle afresh, laid out as for a moving camera. */
  cameraMoved(): void
  /** The camera has stopped: the cards settle afresh, as for a still camera. */
  cameraStopped(): void
  /**
   * A frame of the map: places, updates and removes cards to match the pins, for every game whose
   * venue is on screen on the side of the globe facing the viewer, and the selected game's, then lays
   * them out (see cardLayout), unless holding the layout (see GlobeSettling.holdsLayout). While the
   * pins can't be read, the cards placed stay where they are. Gives back what the settling asks for:
   * another frame, or nothing; `held` when the layout was held, which tells the settling nothing.
   */
  frame(frame: SceneFrame): AfterCardSync | 'held'
  /** Cards done coming in are left as they are; those done going out are removed, and their trails with them. */
  comingsOver(): void
  /** How a game shows on screen now (see cardLayout). */
  shows(gameId: string): Showing
  /** Takes every card off, and forgets the layout. */
  clear(): void
}

/** A card placed for a game: where its venue is, and how the layout last had it. */
interface Card {
  lngLat: [number, number]
  /** Whether it has been laid out, so it has a place on screen (or none, for no room). */
  laidOut: boolean
  inCardCluster: boolean
}

export interface ScoreCardSceneOptions {
  page: CardsOnPage
  /** The globe's settling, told each frame's result and each change from outside (see GlobeSettling). */
  settling: GlobeSettling
  cardCount: CardCount
  /** Whether the viewer asks for less motion: cards then go straight where they're moved. */
  reducedMotion: () => boolean
  /** The time now, as `performance.now()` gives it. */
  now?: () => number
  /** Told each frame the cards are laid out from (see traceLayout). */
  laidOut?: (frame: LaidOutFrame) => void
}

/** The score cards' scene (see ScoreCardScene). */
export function scoreCardScene({ page, settling, cardCount: count, reducedMotion, now = () => performance.now(), laidOut }: ScoreCardSceneOptions): ScoreCardScene {
  const cards = new Map<string, Card>()
  let games = new Map<string, PlacedGame>()
  let selectedGameId: string | null = null
  /**
   * Which cards are coming in or going out, as their games arrive on the board or leave it, or their
   * venues come into view or go out of it (see cardComings).
   */
  const comings = cardComings()
  /** Which cards are gliding to where the card layout moved them (see cardMoves). */
  let moves = cardMoves()
  /**
   * Cards going out, their games gone from the board or their venues out of view, with the trails
   * they had: out of the layout, so they hold no room, and drawn with that trail until they've gone.
   */
  const goingOut = new Map<string, TrailOnGlobe | undefined>()
  /** The trails of the cards laid out, as last drawn. */
  let layoutTrails: TrailOnGlobe[] = []
  /** Where each card goes, and how each game shows, as last laid out (see cardLayout). */
  let layout: CardLayout = cardLayout()
  /** Whether the camera has moved since the cards were last laid out (see cardLayout's CardScene.moving). */
  let moving = false
  let cardCount = count
  /** Whether the card count changed since the cards were last laid out (see cardLayout's CardScene.mostCardsChanged). */
  let mostCardsChanged = false
  let pins: readonly string[] = []
  const lockedOffsets = new Map<string, ScreenOffset>()
  let revealed = new Set<string>()
  let revealRequested = false

  /**
   * Whether cards fade into view and out of it, and glide as they're moved: only once the globe is
   * Ready. Behind the loading screen no one sees them, and the frames their trails ask for would keep
   * the globe from settling as it becomes Ready.
   */
  const animates = () => settling.stage() === 'ready'

  /** Shows the laid-out cards' trails and those going out, each fading with its card if it's coming in or going out, and gliding with it if it's gliding. */
  const showTrails = () => {
    const at = now()
    const withComing = (trail: TrailOnGlobe): TrailOnGlobe => {
      const coming: CardComing | undefined = comings.coming(trail.gameId)
      const move = moves.move(trail.gameId, at)
      if (!coming && !move) return trail
      return { ...trail, ...(coming && { coming }), ...(move && { move }) }
    }
    const goingOutTrails = [...goingOut.values()].flatMap((trail) => (trail ? [trail] : []))
    page.showTrails([...layoutTrails, ...goingOutTrails].map(withComing))
  }

  const removeGoingOut = (gameId: string) => {
    if (!goingOut.has(gameId)) return
    page.removeGoingOut(gameId)
    goingOut.delete(gameId)
    moves.forget(gameId)
  }

  /** A game gone from the board, or its venue out of view: its card, on screen, goes out, out of the layout so it holds no room. */
  const goOut = (gameId: string, at: number, outOfView = false) => {
    if (!cards.delete(gameId)) return
    comings.goOut(gameId, at)
    const trail = layoutTrails.find((trail) => trail.gameId === gameId)
    page.goOut(gameId, at - comings.coming(gameId)!.at, trail, outOfView)
    goingOut.set(gameId, trail)
    layoutTrails = layoutTrails.filter((trail) => trail.gameId !== gameId)
    showTrails()
  }

  /** Lays out these cards and puts each where the layout has it: true if the layout differs from the frame before. */
  const layOut = (gameIds: ReadonlySet<string>, frame: SceneFrame): boolean => {
    const screen = frame.screen()
    // In game order, as the pins come in any order: the layout lands the same way whatever order they
    // come in, and so then do its trails, so the layout isn't given to the map again for their order alone.
    const laidOutCards = [...gameIds].sort().map((gameId): CardLaidOut => {
      const { lngLat } = cards.get(gameId)!
      const { width, height } = page.size(gameId)
      const venue = frame.venue(lngLat)
      const game = games.get(gameId)!
      const selected = gameId === selectedGameId
      const pinOrder = pins.indexOf(gameId)
      let rank = cardRank(game, nearCenter(venue.x, venue.y, screen.width, screen.height))
      const requested = revealed.has(gameId)
      const alreadyShown = revealRequested && layout.shows(gameId).as === 'card'
      // On an explicit reveal, keep eligible cards already showing ahead of unrelated hidden games.
      if (pinOrder >= 0) rank = pinOrder - pins.length - 40
      else if (revealed.size > 0 && selected) rank -= 30
      else if (requested) rank -= 20
      else if (alreadyShown) rank -= 10
      const lockedOffset = lockedOffsets.get(gameId)
      return { gameId, status: game.status, rank, selected, revealed: requested, lockedOffset, venueX: venue.x, venueY: venue.y, width, height, lngLat }
    })
    const screenCards = laidOutCards.map(({ lngLat: _lngLat, ...card }): ScreenCard => card)
    const scene: LayoutScene = {
      ...screen,
      ...frame.layoutScene(),
      moving,
      mostCards: mostCards(screen.width, cardCount),
      mostCardsChanged,
      hardCardLimit: revealed.size > 0,
    }
    moving = false
    mostCardsChanged = false
    revealRequested = false
    laidOut?.({ cards: screenCards, scene })
    const changed = layout.layOut(screenCards, scene)

    // Hidden at the venue gap above its venue while there's no room for it. A card moved further than
    // a step glides there (see cardMoves), unless the viewer asks for less motion.
    const noRoom = { dx: 0, dy: -scene.venueGap }
    const at = now()
    const glides = animates() && !reducedMotion()
    for (const gameId of gameIds) {
      const card = cards.get(gameId)!
      const showing = layout.shows(gameId)
      card.laidOut = true
      card.inCardCluster = showing.as !== 'card'
      if (showing.as === 'card') {
        if (pins.includes(gameId) && !lockedOffsets.has(gameId)) lockedOffsets.set(gameId, showing.offset)
        const glide = glides ? moves.placeAt(gameId, showing.offset, at) : undefined
        page.placeAt(gameId, { offset: showing.offset, moved: showing.moved, glide, inCardCluster: false })
      } else {
        page.placeAt(gameId, { offset: noRoom, moved: false, inCardCluster: true })
        moves.forget(gameId)
      }
    }
    const trails = page.drawLayout(laidOutCards, layout, scene.moving === true)
    if (trails) {
      layoutTrails = trails
      showTrails()
    }
    return changed
  }

  return {
    reveal(gameIds) {
      // A card cluster can also count visible cards whose trails end at it.
      revealed = new Set(gameIds.filter(gameId => games.has(gameId) && layout.shows(gameId).as !== 'card'))
      if (revealed.size === 0) return
      revealRequested = true
      mostCardsChanged = true
      settling.settleAfresh()
    },

    setPinned(gameIds) {
      if (pins === gameIds) return
      pins = gameIds
      for (const gameId of lockedOffsets.keys()) if (!pins.includes(gameId)) lockedOffsets.delete(gameId)
      for (const gameId of pins) {
        if (lockedOffsets.has(gameId)) continue
        const showing = layout.shows(gameId)
        if (showing.as === 'card') lockedOffsets.set(gameId, showing.offset)
      }
      mostCardsChanged = true
      settling.settleAfresh()
    },

    showGames(shown) {
      games = new Map(shown.map((game) => [game.id, game]))
      for (const gameId of revealed) if (!games.has(gameId)) revealed.delete(gameId)
      const { gone, back } = comings.showGames(games.keys())
      // A game back while its card was going out gets a new card, coming in: the old one goes at once.
      for (const gameId of back) removeGoingOut(gameId)
      const at = now()
      for (const gameId of gone) {
        const card = cards.get(gameId)
        // A card on screen goes out; one with no room (or not yet laid out) just goes, as the next frame removes it.
        if (card?.laidOut && !card.inCardCluster) goOut(gameId, at)
      }
      settling.settleAfresh()
    },

    select(gameId) {
      selectedGameId = gameId
      settling.settleAfresh()
    },

    setCardCount(next) {
      if (next === cardCount) return false
      cardCount = next
      mostCardsChanged = true
      settling.settleAfresh()
      return true
    },

    restyled() {
      layout = cardLayout()
      settling.settleAfresh()
    },

    cameraMoved() {
      moving = true
      settling.settleAfresh()
    },

    cameraStopped() {
      settling.settleAfresh()
    },

    frame(frame) {
      const pinsLoaded = frame.pins !== null
      let changed = !pinsLoaded
      // The source reloads after every change of games, and can't be read until it has. Live games
      // can change faster than it loads, so meanwhile the cards placed stay put but still show each change.
      const pins = frame.pins ?? [...cards].map(([gameId, { lngLat }]) => ({ gameId, lngLat }))
      // A venue behind the globe gets no card, rather than one MapLibre fades (and its trail and
      // room in the layout with it): cards fade in and out as their venues cross the horizon, out of
      // the layout at once. Nor does a venue off screen (but the selected game's), so no card hangs
      // over the edge for a venue out of view.
      const wanted = pins.filter(({ gameId, lngLat }) => !frame.behindGlobe(lngLat) && (gameId === selectedGameId || frame.onScreen(lngLat)))

      const keep = new Set<string>()
      for (const { gameId, lngLat } of wanted) {
        const game = games.get(gameId)
        if (!game) continue
        keep.add(gameId)
        const card = cards.get(gameId)
        if (card) {
          card.lngLat = lngLat
          page.moveTo(gameId, lngLat)
        } else {
          const at = now()
          const comes = comings.cardPlaced(gameId, at, animates())
          // Its old card, still fading out of view, goes at once: the new one fades in from as far as that got.
          removeGoingOut(gameId)
          page.place(gameId, lngLat)
          if (comes === 'comesIn') page.comeIn(gameId)
          else if (animates()) page.appear(gameId, at - comings.coming(gameId)!.at)
          cards.set(gameId, { lngLat, laidOut: false, inCardCluster: false })
          changed = true
        }
        if (page.draw(gameId, game)) changed = true
      }

      // Any game arrived and not given a card now comes into view later as cards always have, at once.
      if (pinsLoaded) comings.pinsRead()

      // Having given up settling, the cards stay as the map last drew them and their trails, so the two
      // match, unless a card is new and has yet to be laid out (see GlobeSettling.holdsLayout).
      const held = settling.holdsLayout({ everyCardLaidOut: [...keep].every((gameId) => cards.get(gameId)!.laidOut) })
      if (!held && layOut(keep, frame)) changed = true

      const at = now()
      for (const [gameId, card] of cards) {
        if (keep.has(gameId)) continue
        // A card on screen whose venue has gone out of view (behind the globe, or off screen) fades
        // out; one with no room, or not yet laid out, just goes.
        if (animates() && games.has(gameId) && card.laidOut && !card.inCardCluster) goOut(gameId, at, true)
        else {
          cards.delete(gameId)
          page.dispose(gameId)
          moves.forget(gameId)
        }
        changed = true
      }
      // Still unsettled, but asking for no frames: the map can go idle.
      if (held) return 'held'
      // Each frame's layout starts from the last, and the map draws a frame only when something on it
      // changes: so while the cards are still moving, ask for another (see GlobeSettling.cardsSynced).
      return settling.cardsSynced({ changed, pinsLoaded })
    },

    comingsOver() {
      const { cameIn, wentOut } = comings.over(now())
      for (const gameId of cameIn) if (cards.has(gameId)) page.cameIn(gameId)
      for (const gameId of wentOut) removeGoingOut(gameId)
      if (cameIn.length > 0 || wentOut.length > 0) showTrails()
    },

    shows: (gameId) => layout.shows(gameId),

    clear() {
      for (const gameId of [...cards.keys()]) {
        cards.delete(gameId)
        page.dispose(gameId)
      }
      for (const gameId of [...goingOut.keys()]) removeGoingOut(gameId)
      layoutTrails = []
      layout = cardLayout()
      moves = cardMoves()
      revealed.clear()
      lockedOffsets.clear()
    },
  }
}
