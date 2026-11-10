import type { LoadingStage } from './globeMap'

/** About a second of frames: longer than any card layout takes to settle. */
export const maxSettlingFrames = 60

/** What a card sync asks for (see GlobeSettling.cardsSynced). */
export type AfterCardSync = 'askForFrame' | 'nothing' | 'giveUp'

/** The stages the globe's settling tells (see LoadingStage): construction errors are Globe's. */
export type SettlingStage = Exclude<LoadingStage, 'constructionError'>

/**
 * The globe's settling: when the globe is still right now (settled), and when it first becomes
 * Ready (see GLOSSARY.md). A plain object, told what happens on the map and answering what follows;
 * it never touches MapLibre or the page. GlobeMap and ScoreCardMarkers both report to the one object.
 *
 * Whether the pin sources have loaded is given in by its caller each time it's needed.
 *
 * It relies on one order of events from the map: as the map goes idle, the score cards sync (see
 * cardsSynced) before the settling is told the map went idle (see wentIdle), so Ready is checked
 * after that idle's card sync.
 */
export interface GlobeSettling {
  /**
   * A score card sync's result: whether it changed any card (placed, redrawn, moved or removed), and
   * whether the pins it places them from were loaded. Answers whether the cards should ask the map
   * for another frame: each frame's layout starts from the last, and the map draws a frame only when
   * something on it changes, so while the cards are still moving they ask for another, up to
   * maxSettlingFrames in a row. On the next changing sync with the pins loaded they give up, and ask
   * for nothing more until they settle afresh (see holdsLayout and settleAfresh). Pins still loading
   * spend none of the count: they'll draw frames of their own, and the layout gets its full count
   * once they've loaded, however long they took.
   */
  cardsSynced(sync: { changed: boolean; pinsLoaded: boolean }): AfterCardSync
  /**
   * Whether a card sync should hold the card layout as the map last drew it, cards and trails alike
   * so the two match, and tell nothing of the sync (see cardsSynced): so once given up, until a
   * change from outside. A card not yet laid out has the cards settle afresh instead.
   */
  holdsLayout(cards: { everyCardLaidOut: boolean }): boolean
  /**
   * A change from outside the score cards (a camera move, a selection, a restyle, new games): they
   * stop holding their layout, and get the full count of frames to settle again.
   */
  settleAfresh(): void
  /** The globe has been given something to show: not settled until the map goes idle again. */
  unsettle(): void
  /** The map has drawn a frame: not settled until it goes idle again. */
  frameDrawn(): void
  /**
   * The map has gone idle: nothing loading, moving or left to place. Ready the first time this
   * comes with games, the pins loaded, and the score cards steady or given up: a layout that never
   * steadies mustn't keep the loading screen up. Only on going idle can the globe become settled:
   * every other change to the cards comes with a frame drawn or the globe unsettled. Having given
   * up, the cards ask for no frames and give the map nothing new to draw, so it goes idle after them.
   */
  wentIdle(pins: { pinsLoaded: boolean }): void
  /** The server's first snapshot of games has arrived (or a later one). */
  gamesArrived(): void
  /** The initial style failed to load. */
  styleFailed(): void
  /**
   * Whether the globe is still right now: the map idle with the pins loaded, and the score cards
   * steady. False again after any change or frame drawn. Not a synonym for Ready (see stage).
   */
  settled(pins: { pinsLoaded: boolean }): boolean
  /**
   * How far the initial load has got: waiting for games until they first arrive, drawing until first
   * Ready, then ready for good. A failed initial style stays at styleError.
   */
  stage(): SettlingStage
  /**
   * Whether the score cards have stopped moving: their last sync changed nothing, with the pins
   * loaded. Unlike settled, this holds while the camera moves.
   */
  cardsSteady(): boolean
}

/**
 * The globe's settling (see GlobeSettling). `onStage` is told each change of stage, once; `onReady`
 * is told the once the globe becomes Ready, just before onStage is.
 */
export function globeSettling({ onStage, onReady }: { onStage: (stage: SettlingStage) => void; onReady: () => void }): GlobeSettling {
  /** Whether the last card sync changed any card, or couldn't yet read the pins (see cardsSteady). */
  let cardsChanged = true
  /** How many card syncs in a row have changed something, to stop asking for frames that never settle. */
  let changingSyncs = 0
  /** Whether the cards have given up settling (see holdsLayout). */
  let gaveUp = false
  /** Whether the map has gone idle since it last drew a frame or the globe was given anything to show. */
  let idle = false
  let hasGames = false
  let failed = false
  /** Whether the globe has been Ready: once true, it stays true. */
  let wasReady = false
  let toldStage: SettlingStage = 'waitingForGames'

  const settleAfresh = () => {
    gaveUp = false
    changingSyncs = 0
  }
  const stage = (): SettlingStage => {
    if (failed) return 'styleError'
    if (wasReady) return 'ready'
    return hasGames ? 'drawing' : 'waitingForGames'
  }
  const tellStage = () => {
    const now = stage()
    if (now === toldStage) return
    toldStage = now
    onStage(now)
  }
  const still = (pinsLoaded: boolean) => pinsLoaded && idle

  return {
    cardsSynced({ changed, pinsLoaded }) {
      cardsChanged = changed
      if (!pinsLoaded) {
        changingSyncs = 0
        return 'nothing'
      }
      changingSyncs = changed ? changingSyncs + 1 : 0
      if (!changed) return 'nothing'
      if (changingSyncs <= maxSettlingFrames) return 'askForFrame'
      gaveUp = true
      return 'giveUp'
    },
    holdsLayout({ everyCardLaidOut }) {
      if (!gaveUp) return false
      if (everyCardLaidOut) return true
      settleAfresh()
      return false
    },
    settleAfresh,
    unsettle() {
      idle = false
    },
    frameDrawn() {
      idle = false
    },
    wentIdle({ pinsLoaded }) {
      idle = true
      if (wasReady || !hasGames) return
      if (!still(pinsLoaded) || !(!cardsChanged || gaveUp)) return
      wasReady = true
      onReady()
      tellStage()
    },
    gamesArrived() {
      hasGames = true
      tellStage()
    },
    styleFailed() {
      failed = true
      tellStage()
    },
    settled: ({ pinsLoaded }) => still(pinsLoaded) && !cardsChanged,
    stage,
    cardsSteady: () => !cardsChanged,
  }
}
