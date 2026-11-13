import { gameLabel } from '../games/gameLabel'
import type { GeoJSONSource, Map as MapLibreMap } from 'maplibre-gl'
import type { Feature, Point } from 'geojson'
import type { Game } from '../games/game'
import type { PlacedGame } from '../games/placedGames'
import { sidesTopFirst } from '../games/sides'
import { noneJustHappened, scorerOf, type JustHappened } from '../games/justHappened'
import { spotlightElapsed, type Scorer } from '../games/scorers'
import { statusKey, type Theme } from '../theme/theme'
import { cardComings } from './cardComings'
import { cardPins, type CardPin } from './cardPins'
import { cardLayout, type CardLayout, type LayoutScene, type ScreenCard, type Showing, type VenueSizes } from './cardLayout'
import { cardLayoutDrawing, cardLayoutSource, type CardOnGlobe, type DrawnCardCluster } from './cardLayoutLayers'
import type { PinAnimation } from './pinAnimation'
import { PlacedCard, animationClass } from './placedCard'
import { pinSource } from './pinLayers'
import type { PlaceNames } from './placeNames'
import { pulse } from './pinPulse'
import { isBehindGlobe } from './horizon'
import { traceLayout } from './layoutTrace'
import type { GlobeSettling } from './globeSettling'
import { headerText, scoreCard, type ScoreCard, type ScoreCardRow } from './scoreCard'
import type { TrailLayer, TrailOnGlobe } from './trailLayer'
import { selectedStacking, stacking } from './statusLook'
import { hasCard } from './zoomLevels'

// How far, in pixels, what's given to the map of a layout may come off where the layout puts it on
// screen before it's given again (see drawLayout): a point worked out on screen as the globe turns,
// or a footprint as its card moves. Still, less doesn't show; while the camera moves, a little more
// doesn't either (a footprint is a rough stand-in for its card anyway), and it's given less often.
const maxDrift = { still: { point: 0.5, footprint: 0.5 }, moving: { point: 1.5, footprint: 4 } }

/**
 * A score card on the page now that a viewer can see, for pointing at it (Click a score card). Its
 * elements are for lighting and measuring it, not for looking inside.
 */
export interface ShownScoreCard {
  gameId: string
  /** Its game's name, as the card's own button gives it (see gameLabel). */
  label: string
  /** Where the card is on the page now. */
  box: DOMRect
  /** The card itself. */
  element: Element
  /** Its two rows, top first: for an arrow to end level with. */
  rows: Element[]
}

/**
 * At every zoom, shows each pin near the center of the view as an HTML score card (logos,
 * abbreviations, score, clock line). Cards that would overlap are moved apart with a trail back to
 * their venue; where there's no room for them all, the rest are shown as a card cluster. The trails
 * and card clusters are drawn by the map, beneath the place names (see cardLayoutLayers).
 */
export class ScoreCardMarkers {
  private readonly placed = new Map<string, PlacedCard>()
  private games = new Map<string, PlacedGame>()
  private justHappened: JustHappened = noneJustHappened
  private selectedGameId: string | null = null
  /** The game whose card the pointer is on, if any: its trail and venue dot are drawn bolder (see cardLayoutLayers). */
  private hoveredGameId: string | null = null
  /** Which cards are coming in or going out, as their games arrive on the board or leave it (see cardComings). */
  private readonly comings = cardComings()
  /**
   * Cards going out, their games gone from the board: out of the layout, so they hold no room, and
   * drawn with the trail they had until they've gone.
   */
  private readonly goingOut = new Map<string, PlacedCard>()
  /** The trails of the cards laid out, as last drawn (see drawLayout). */
  private layoutTrails: TrailOnGlobe[] = []
  private readonly map: MapLibreMap
  private readonly theme: () => Theme
  private readonly colorOf: (game: Game) => string
  private readonly placeNames: PlaceNames
  private readonly trails: TrailLayer
  private readonly onSelect: (gameId: string) => void
  /** Where each card goes, and how each game shows, as last laid out (see cardLayout). */
  private layout: CardLayout = cardLayout()
  /** The card clusters as last drawn, for pulses over them (see cardLayoutDrawing). */
  private cardClustersDrawn: DrawnCardCluster[] = []
  /**
   * The layout last given to the map (see drawLayout), so it's given again only when it changes: its
   * features with the points worked out on screen left blank, and where on the globe those points were put.
   */
  private layoutDrawn: { shape: string; lngLats: [number, number][]; footprints: number[][] } = { shape: '', lngLats: [], footprints: [] }
  /** The globe's settling, told each sync's result and each change from outside (see GlobeSettling). */
  private readonly settling: GlobeSettling
  /** Whether the camera has moved since the cards were last laid out (see CardScene.moving). */
  private moving = false
  /**
   * The map's size on screen, until it's resized: reading it from the page each frame would have the
   * browser work out the cards' styles, just moved, there and then.
   */
  private mapSize: { width: number; height: number } | null = null

  /**
   * `theme` gives the theme as it is now, for how far above its venue a card sits; `colorOf` gives a
   * game's color as it is now (see gameColor), for its card, its trail and its pulses over card
   * clusters; `placeNames` gives the names cards keep clear of; `trails` draws the moved cards'
   * trails; `onSelect` is called with a game's id when its card is selected; `settling` is the
   * globe's settling, which the cards report to and which says when to ask for a frame.
   */
  constructor(
    map: MapLibreMap,
    theme: () => Theme,
    colorOf: (game: Game) => string,
    placeNames: PlaceNames,
    trails: TrailLayer,
    onSelect: (gameId: string) => void,
    settling: GlobeSettling,
  ) {
    this.settling = settling
    this.map = map
    this.theme = theme
    this.colorOf = colorOf
    this.placeNames = placeNames
    this.trails = trails
    this.onSelect = onSelect
    // The camera moving (a pan, a zoom, a resize) moves the cards on screen: they settle afresh.
    map.on('move', this.cameraMoved)
    // Once the camera stops, the cards settle as for a still camera (see CardScene.cameraMoving).
    map.on('moveend', this.cameraStopped)
    map.on('resize', this.resized)
  }

  /** Highlights the selected game's card and its trail, if it has them. */
  setSelected(gameId: string | null): void {
    this.selectedGameId = gameId
    this.trails.select(gameId)
    this.settling.settleAfresh()
    this.sync()
  }

  /**
   * After a change of theme, with the page's CSS already in it, or of the games' colors:
   * each card redrawn in its game's color, measured afresh, as its text, spacing and sizes may have changed,
   * and laid out again.
   */
  restyle(): void {
    for (const placed of this.placed.values()) placed.measure()
    this.settling.settleAfresh()
    this.sync()
  }

  /** Where a game's card is on the page, if it has one. */
  cardOnPage(gameId: string): DOMRect | null {
    return this.placed.get(gameId)?.element.getBoundingClientRect() ?? null
  }

  /**
   * The cards on the page now that a viewer can see, each measured now: those whose games are counted
   * in a card cluster are left out. What's given is for pointing at a card (see ShownScoreCard).
   */
  shownCards(): ShownScoreCard[] {
    const shown: ShownScoreCard[] = []
    for (const [gameId, placed] of this.placed) {
      const game = this.games.get(gameId)
      if (!game || placed.inCardCluster) continue
      const { element, rows } = placed
      shown.push({ gameId, label: gameLabel(game), box: element.getBoundingClientRect(), element, rows })
    }
    return shown
  }

  /** Shows these games, lighting up the side that just scored in each (see justHappened.ts). */
  setGames(games: readonly PlacedGame[], justHappened: JustHappened = noneJustHappened): void {
    this.games = new Map(games.map((game) => [game.id, game]))
    this.justHappened = justHappened
    const { gone, back } = this.comings.showGames(this.games.keys())
    // A game back while its card was going out gets a new card, coming in: the old one goes at once.
    for (const gameId of back) this.removeGoingOut(gameId)
    const now = performance.now()
    for (const gameId of gone) {
      const placed = this.placed.get(gameId)
      // A card on screen goes out; one with no room (or not yet laid out) just goes, as sync removes it.
      if (placed?.offset && !placed.inCardCluster) this.goOut(gameId, now)
    }
    this.settling.settleAfresh()
    this.sync()
  }

  /**
   * Places, updates and removes cards to match what the pin source shows, on the side of the globe facing the viewer, for games near the center of the view (see hasCard).
   */
  sync(): void {
    if (!this.map.getSource(pinSource)) return
    const pinsLoaded = this.map.isSourceLoaded(pinSource)
    let changed = !pinsLoaded
    const pins = pinsLoaded
      ? cardPins(this.map.querySourceFeatures(pinSource) as Feature<Point>[])
      : // The source reloads after every change of games, and can't be read until it has. Live games
        // can change faster than it loads, so meanwhile the cards placed stay put but still show
        // each change.
        this.placedPins()
    // A venue behind the globe gets no card, rather than one MapLibre fades (and its trail and
    // room in the layout with it): cards pop in and out as their venues cross the horizon. So do
    // they as their venues cross the card radius, where they swap with small pins (see GlobeMap).
    const { lng: longitude, lat: latitude } = this.map.getCenter()
    const wanted = pins.filter(
      ({ lngLat }) =>
        !isBehindGlobe(this.map, lngLat) && hasCard({ longitude, latitude }, { longitude: lngLat[0], latitude: lngLat[1] }),
    )

    const keep = new Set<string>()
    for (const { gameId, lngLat } of wanted) {
      const game = this.games.get(gameId)
      if (!game) continue
      keep.add(gameId)
      const color = this.colorOf(game)
      const flames = game.hot
      const selected = gameId === this.selectedGameId
      const theme = this.theme()
      const scorer = scorerOf(this.justHappened, gameId)
      let placed = this.placed.get(gameId)
      if (!placed) {
        placed = new PlacedCard(this.map, gameId, lngLat, {
          select: () => this.onSelect(gameId),
          hover: (on) => {
            if (on) this.hover(gameId)
            else if (this.hoveredGameId === gameId) this.hover(null)
          },
        })
        if (this.comings.cardPlaced(gameId, performance.now())) placed.comeIn(this.comingsOver)
        this.placed.set(gameId, placed)
        changed = true
      } else placed.moveTo(lngLat)
      const from = placed.drawnFrom
      if (from?.game === game && from.color === color && from.flames === flames && from.selected === selected && from.theme === theme && from.scorer === scorer) continue
      placed.drawnFrom = { game, color, flames, selected, theme, scorer }
      const card = scoreCard(game)
      placed.element.setAttribute('aria-label', gameLabel(game))
      const header = headerText(color, theme)
      const drawn = JSON.stringify({ card, color, header, selected, scorer })
      if (placed.drawn !== drawn) {
        // Live cards draw on top, as Live small pins do; the selected card above all.
        placed.markerElement.style.zIndex = String(selected ? selectedStacking : stacking[card.status])
        placed.rows = drawScoreCard(placed.element, card, { color, header }, selected, placed.animation)
        spotlightScorer(placed.rows, game, scorer)
        placed.drawn = drawn
        placed.measure()
        changed = true
      }
    }

    // Any game arrived and not given a card now comes into view later as cards always have, at once.
    if (pinsLoaded) this.comings.pinsRead()

    // Having given up settling, the cards stay as the map last drew them and their trails, so the two
    // match, unless a card is new and has yet to be laid out (see GlobeSettling.holdsLayout).
    const held = this.settling.holdsLayout({ everyCardLaidOut: [...keep].every((gameId) => this.placed.get(gameId)!.offset) })
    if (!held && this.layOut(keep)) changed = true

    for (const gameId of this.placed.keys()) {
      if (keep.has(gameId)) continue
      this.takeOff(gameId)?.dispose()
      changed = true
    }
    // Still unsettled, but asking for no frames: the map can go idle.
    if (held) return
    // Each frame's layout starts from the last, and the map draws a frame only when something on it
    // changes: so while the cards are still moving, ask for another (see GlobeSettling.cardsSynced).
    if (this.settling.cardsSynced({ changed, pinsLoaded }) === 'askForFrame') this.map.triggerRepaint()
  }

  private readonly resized = () => (this.mapSize = null)

  private readonly cameraMoved = () => {
    this.moving = true
    this.settling.settleAfresh()
  }

  private readonly cameraStopped = () => {
    this.settling.settleAfresh()
    this.map.triggerRepaint()
  }

  /** Where the cards placed now are. */
  private placedPins(): CardPin[] {
    return [...this.placed].map(([gameId, { lngLat }]) => ({ gameId, lngLat }))
  }

  /**
   * Lays out the cards (see cardLayout) and puts each where the layout has it: moved aside with a trail
   * back to its venue, or hidden while there's no room for it. True if the layout differs from the
   * frame before.
   */
  private layOut(gameIds: ReadonlySet<string>): boolean {
    // In game order, as the pins come in any order: the layout lands the same way whatever order they
    // come in, and so then do its trails, so the layout isn't given to the map again for their order alone.
    const cards = [...gameIds].sort().map((gameId): ScreenCard => {
      const { lngLat, width, height } = this.placed.get(gameId)!
      const venue = this.map.project(lngLat)
      return { gameId, status: this.games.get(gameId)!.status, venueX: venue.x, venueY: venue.y, width, height }
    })
    this.mapSize ??= { width: this.map.getCanvas().clientWidth, height: this.map.getCanvas().clientHeight }
    const theme = this.theme()
    const scene: LayoutScene = {
      ...this.mapSize,
      venueGap: theme.components.ScoreCard.size.venueGap,
      names: this.placeNames.nameBoxes(),
      moving: this.moving,
      cameraMoving: this.map.isMoving(),
      venueSizes: venueSizes(theme),
    }
    this.moving = false
    traceLayout({ cards, scene })
    const changed = this.layout.layOut(cards, scene)

    // Hidden at the venue gap above its venue while there's no room for it.
    const noRoom = { dx: 0, dy: -scene.venueGap }
    for (const gameId of gameIds) {
      const placed = this.placed.get(gameId)!
      const showing = this.layout.shows(gameId)
      placed.placeAt(showing.as === 'card' ? showing.offset : noRoom, showing.as === 'card' && showing.moved)
      placed.setInCardCluster(showing.as !== 'card')
    }
    const onGlobe = cards.map((card): CardOnGlobe => {
      const game = this.games.get(card.gameId)!
      return { ...card, lngLat: this.placed.get(card.gameId)!.lngLat, color: this.colorOf(game), flames: game.hot }
    })
    this.cardClustersDrawn = this.drawLayout(onGlobe, scene.moving === true)
    // A card on screen is always shown with its city's name; a game in a cluster gives its name way.
    this.placeNames.showCards(
      onGlobe.filter(({ gameId }) => this.layout.shows(gameId).as === 'card').map(({ lngLat: [longitude, latitude] }) => ({ longitude, latitude })),
    )
    return changed
  }

  /**
   * Gives the trail layer the moved cards' trails, and the map the venue clusters, card clusters and
   * footprints of a layout (see cardLayoutLayers), when they've changed. The trail layer draws the
   * trails each frame where the cards are then. The rest are places on the globe, so as it turns they
   * move on screen with it: they're given again only when the layout changes, or the globe turning
   * has carried a point worked out on screen (a venue cluster's, between its venues) or a footprint
   * off where it should be. Giving them again sends them to MapLibre's worker to be made into tiles,
   * too slow for every frame of a pan. Gives back the card clusters as drawn.
   */
  private drawLayout(cards: readonly CardOnGlobe[], moving: boolean): DrawnCardCluster[] {
    // Each point worked out on screen, by the place on the globe it was turned into.
    const onScreen = new Map<[number, number], [number, number]>()
    const unproject = (x: number, y: number) => {
      const lngLat = this.map.unproject([x, y]).toArray()
      onScreen.set(lngLat, [x, y])
      return lngLat
    }
    const { source: features, trails, cardClusters } = cardLayoutDrawing(cards, this.layout, unproject)
    const source = this.map.getSource<GeoJSONSource>(cardLayoutSource)
    if (!source) return cardClusters
    this.layoutTrails = trails
    this.showTrails()
    // The features with those points and the footprints' offsets left out, which are compared by how far they've come.
    const footprints: number[][] = []
    const shape = JSON.stringify(features, (key, value: unknown) => {
      if (Array.isArray(value) && onScreen.has(value as [number, number])) return null
      if (key !== 'offset') return value
      footprints.push(value as number[])
      return null
    })
    const drawn = this.layoutDrawn
    const max = moving ? maxDrift.moving : maxDrift.still
    const points = [...onScreen.values()]
    const held =
      shape === drawn.shape &&
      points.every(([x, y], i) => {
        const at = this.map.project(drawn.lngLats[i])
        return Math.hypot(at.x - x, at.y - y) <= max.point
      }) &&
      footprints.every(([dx, dy], i) => Math.hypot(dx - drawn.footprints[i][0], dy - drawn.footprints[i][1]) <= max.footprint)
    if (held) return cardClusters
    void source.setData(features)
    this.layoutDrawn = { shape, lngLats: [...onScreen.keys()], footprints }
    return cardClusters
  }

  /**
   * Takes a game's card off the layout, its hover with it, for it to be disposed or go out: the one way
   * a card laid out leaves.
   */
  private takeOff(gameId: string): PlacedCard | undefined {
    const placed = this.placed.get(gameId)
    if (!placed) return undefined
    if (gameId === this.hoveredGameId) this.hover(null)
    this.placed.delete(gameId)
    return placed
  }

  /** A game gone from the board: its card, on screen, goes out, out of the layout so it holds no room. */
  private goOut(gameId: string, now: number): void {
    const placed = this.takeOff(gameId)
    if (!placed) return
    this.comings.goOut(gameId, now)
    placed.goOut(now - this.comings.coming(gameId)!.at, this.layoutTrails.find((trail) => trail.gameId === gameId), this.comingsOver)
    this.goingOut.set(gameId, placed)
    this.layoutTrails = this.layoutTrails.filter((trail) => trail.gameId !== gameId)
    this.showTrails()
  }

  private removeGoingOut(gameId: string): void {
    this.goingOut.get(gameId)?.dispose()
    this.goingOut.delete(gameId)
  }

  /** Cards done coming in are left as they are; those done going out are removed, and their trails with them. */
  private readonly comingsOver = () => {
    const { cameIn, wentOut } = this.comings.over(performance.now())
    for (const gameId of cameIn) this.placed.get(gameId)?.cameIn()
    for (const gameId of wentOut) this.removeGoingOut(gameId)
    if (cameIn.length > 0 || wentOut.length > 0) this.showTrails()
  }

  /** Gives the trail layer the laid-out cards' trails and those going out, each fading with its card if it's coming in or going out. */
  private showTrails(): void {
    const withComing = (trail: TrailOnGlobe): TrailOnGlobe => {
      const coming = this.comings.coming(trail.gameId)
      return coming ? { ...trail, coming } : trail
    }
    const goingOut = [...this.goingOut.values()].flatMap(({ trail }) => (trail ? [trail] : []))
    this.trails.show([...this.layoutTrails, ...goingOut].map(withComing))
  }

  /** How a game shows on screen now (see cardLayout). */
  shows(gameId: string): Showing {
    return this.layout.shows(gameId)
  }

  /** The games in each card cluster on screen now, those with no room first. */
  cardClusters(): readonly (readonly string[])[] {
    return this.layout.cardClusters()
  }

  /**
   * Plays an animation on a game's card, or when there's no room for its card, over the count it's
   * in or its small pin. False when the game has none of them on screen.
   */
  animate(gameId: string, animation: PinAnimation): boolean {
    // A game whose card is on screen animates its card, though its trail meets at a card cluster.
    const showing = this.layout.shows(gameId)
    const game = this.games.get(gameId)
    const placed = this.placed.get(gameId)
    if (showing.as === 'inCardCluster' && game) {
      const drawn = this.cardClustersDrawn.find(({ gameIds }) => gameIds[0] === showing.cardCluster[0])
      if (drawn) pulse(this.map, this.colorOf(game), drawn.lngLat, animation, 'cluster')
      return drawn !== undefined
    }
    if (showing.as === 'smallPin' && game && placed) {
      pulse(this.map, this.colorOf(game), placed.lngLat, animation, 'pin')
      return true
    }
    if (!placed) return false
    placed.pulse(animation)
    return true
  }

  /** Draws a game's trail and venue dot bolder, and the last game's no longer (see trailLayer). */
  private hover(gameId: string | null): void {
    this.hoveredGameId = gameId
    this.trails.hover(gameId)
  }

  clear(): void {
    for (const gameId of [...this.placed.keys()]) this.takeOff(gameId)!.dispose()
    this.hover(null)
    for (const gameId of [...this.goingOut.keys()]) this.removeGoingOut(gameId)
    this.layoutTrails = []
    this.layout = cardLayout()
    this.cardClustersDrawn = []
  }
}

/** How far what the card layout gathers into reaches on screen (see VenueSizes), as cardLayoutLayers draws it. */
function venueSizes(theme: Theme): VenueSizes {
  const { ring } = theme.components.Trail.venue
  return {
    dot: ring.radius + ring.width,
    // A venue cluster is drawn as a venue dot is (see cardLayoutLayers).
    venueCluster: ring.radius + ring.width,
    // As wide as a pin cluster of some games, outline and all (see cardLayoutLayers).
    cardCluster: theme.components.Cluster.radius.some,
  }
}

/** A score card's colors: its game's (see gameColor), and its header's text, readable on its tint (see headerText). */
interface CardColors {
  color: string
  header: string
}

/** Draws a score card into its element, giving its two rows, top first. */
function drawScoreCard(element: HTMLElement, card: ScoreCard, { color, header: headerColor }: CardColors, selected: boolean, animation?: PinAnimation): Element[] {
  element.className = `score-card score-card--${statusKey(card.status)}`
  // In its game's color, in place of its status's from the page's CSS.
  element.style.setProperty('--game-color', color)
  element.style.setProperty('--header-text', headerColor)
  element.classList.toggle('score-card--selected', selected)
  if (animation) element.classList.add(animationClass(animation))
  element.dataset.gameId = card.gameId
  // A header strip with the clock (or the status), then the teams.
  const header = document.createElement('div')
  header.className = 'score-card__header'
  header.append(span('score-card__clock', card.clockLine || card.status))
  const rows = [team(card.top), team(card.bottom)]
  element.replaceChildren(header, ...rows)
  if (card.flames) element.append(flames())
  return rows
}

/** The fire outline around a hot game's card, shaped and animated by the CSS. */
/**
 * Lights up the row of the side that just scored, for what's left of its spotlight: the glow is the
 * CSS's, started as far in as the spotlight already is, so a card redrawn partway (for its clock)
 * carries on rather than starting over.
 */
function spotlightScorer(rows: readonly Element[], game: Game, scorer: Scorer | undefined): void {
  const elapsed = spotlightElapsed(scorer, performance.now())
  if (elapsed === null || !scorer || game.contest.kind !== 'sides') return
  const row = rows[sidesTopFirst(game.sport, game.contest).indexOf(game.contest[scorer.side])] as HTMLElement | undefined
  row?.classList.add('score-card__team--scored')
  row?.style.setProperty('--scorer-spotlight-delay', `${-elapsed}ms`)
}

function flames(): HTMLElement {
  const outline = span('score-card__flames', '')
  outline.setAttribute('aria-hidden', 'true')
  return outline
}

function logo({ logoUrl }: ScoreCardRow): HTMLImageElement {
  const image = document.createElement('img')
  image.className = 'score-card__logo'
  image.alt = ''
  if (logoUrl) image.src = logoUrl
  else image.style.visibility = 'hidden'
  return image
}

function team(card: ScoreCardRow): HTMLElement {
  const row = document.createElement('div')
  row.className = 'score-card__team'
  const label = span('score-card__abbreviation', card.label)
  if (card.rank) label.prepend(span('score-card__rank', card.rank), ' ')
  row.append(logo(card), label, span('score-card__score', card.score))
  return row
}

function span(className: string, text: string): HTMLElement {
  const element = document.createElement('span')
  element.className = className
  element.textContent = text
  return element
}
