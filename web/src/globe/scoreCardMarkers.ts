import { gameLabel } from '../games/gameLabel'
import { focusGameNavigation } from '../games/gameFocus'
import { Marker, type GeoJSONSource, type Map as MapLibreMap } from 'maplibre-gl'
import type { Feature, Point } from 'geojson'
import type { Game } from '../games/game'
import type { PlacedGame } from '../games/placedGames'
import { sidesTopFirst } from '../games/sides'
import { noneJustHappened, scorerOf, type JustHappened } from '../games/justHappened'
import { spotlightElapsed, type Scorer } from '../games/scorers'
import { statusKey, type Theme } from '../theme/theme'
import { cardPins, type CardPin } from './cardPins'
import { cardLayout, type CardLayout, type LayoutScene, type ScreenCard, type ScreenOffset, type Showing, type VenueSizes } from './cardLayout'
import { cardLayoutDrawing, cardLayoutSource, type CardOnGlobe, type DrawnCardCluster } from './cardLayoutLayers'
import type { PinAnimation } from './pinAnimation'
import { pinSource } from './pinLayers'
import type { PlaceNames } from './placeNames'
import { pulse } from './pinPulse'
import { isBehindGlobe } from './horizon'
import { traceLayout } from './layoutTrace'
import type { GlobeSettling } from './globeSettling'
import { headerText, scoreCard, type ScoreCard, type ScoreCardRow } from './scoreCard'
import type { TrailLayer } from './trailLayer'
import { selectedStacking, stacking } from './statusLook'
import { hasCard, pinSize } from './zoomLevels'

// How far, in pixels, what's given to the map of a layout may come off where the layout puts it on
// screen before it's given again (see drawLayout): a point worked out on screen as the globe turns,
// or a footprint as its card moves. Still, less doesn't show; while the camera moves, a little more
// doesn't either (a footprint is a rough stand-in for its card anyway), and it's given less often.
const maxDrift = { still: { point: 0.5, footprint: 0.5 }, moving: { point: 1.5, footprint: 4 } }

interface PlacedCard {
  marker: Marker
  /** The card last drawn into the marker, so unchanged cards aren't redrawn every frame. */
  drawn: string
  /** What the card was last drawn from, so it's worked out afresh only when one of them changes. */
  drawnFrom: { game: Game; color: string; flames: boolean; selected: boolean; theme: Theme; scorer: Scorer | undefined } | null
  /** The card's two rows as last drawn, top first. */
  rows: Element[]
  /** The card's size on screen, measured when it's drawn. */
  width: number
  height: number
  /**
   * Where the card sits from its venue: just above it, or moved aside to make room for others (see
   * cardLayout). Null until it's first laid out.
   */
  offset: ScreenOffset | null
  /** True while there's no room for the card: its game is counted in a card cluster, or shows as its small pin. */
  inCardCluster: boolean
}

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
 * Zoomed in, shows each pin as an HTML score card (logos, abbreviations, score, clock line). Cards
 * that would overlap are moved apart with a trail back to their venue; where there's no room for
 * them all, the rest are shown as a card cluster. The trails and card clusters are drawn by the map,
 * beneath the place names (see cardLayoutLayers). Zoomed out, the small-pin and pin cluster layers
 * show instead and no cards are placed.
 */
export class ScoreCardMarkers {
  private readonly placed = new Map<string, PlacedCard>()
  private games = new Map<string, PlacedGame>()
  private justHappened: JustHappened = noneJustHappened
  private selectedGameId: string | null = null
  /** The game whose card the pointer is on, if any: its trail and venue dot are drawn bolder (see cardLayoutLayers). */
  private hoveredGameId: string | null = null
  /** Cards mid-animation, so redrawing a card (say, with its new score) doesn't cut the animation short. */
  private readonly animating = new Map<string, PinAnimation>()
  private readonly map: MapLibreMap
  private readonly theme: () => Theme
  private readonly colorOf: (game: Game) => string
  private readonly placeNames: PlaceNames
  private readonly trails: TrailLayer
  /** The zoom score cards show from now (see FittedZoom). */
  private readonly cardZoom: () => number
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
    cardZoom: () => number,
    onSelect: (gameId: string) => void,
    settling: GlobeSettling,
  ) {
    this.settling = settling
    this.cardZoom = cardZoom
    this.map = map
    this.theme = theme
    this.colorOf = colorOf
    this.placeNames = placeNames
    this.trails = trails
    this.onSelect = onSelect
    // The camera moving (a pan, a zoom, a resize) moves the cards on screen: they settle afresh.
    map.on('move', this.cameraMoved)
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
    for (const placed of this.placed.values()) {
      const cardElement = placed.marker.getElement().firstElementChild as HTMLElement
      placed.width = cardElement.offsetWidth
      placed.height = cardElement.offsetHeight
    }
    this.settling.settleAfresh()
    this.sync()
  }

  /** Where a game's card is on the page, if it has one. */
  cardOnPage(gameId: string): DOMRect | null {
    const element = this.placed.get(gameId)?.marker.getElement().firstElementChild
    return element ? element.getBoundingClientRect() : null
  }

  /**
   * The cards on the page now that a viewer can see, each measured now: those whose games are counted
   * in a card cluster are left out. What's given is for pointing at a card (see ShownScoreCard).
   */
  shownCards(): ShownScoreCard[] {
    const shown: ShownScoreCard[] = []
    for (const [gameId, placed] of this.placed) {
      const game = this.games.get(gameId)
      const element = placed.marker.getElement().firstElementChild
      if (!game || !element || placed.inCardCluster) continue
      shown.push({ gameId, label: gameLabel(game), box: element.getBoundingClientRect(), element, rows: placed.rows })
    }
    return shown
  }

  /** Shows these games, lighting up the side that just scored in each (see justHappened.ts). */
  setGames(games: readonly PlacedGame[], justHappened: JustHappened = noneJustHappened): void {
    this.games = new Map(games.map((game) => [game.id, game]))
    this.justHappened = justHappened
    this.settling.settleAfresh()
    this.sync()
  }

  /**
   * Places, updates and removes cards to match what the pin source shows at the current zoom, on the
   * side of the globe facing the viewer, for games near the center of the view (see hasCard).
   */
  sync(): void {
    if (!this.map.getSource(pinSource)) return
    const pinsLoaded = this.map.isSourceLoaded(pinSource)
    let changed = !pinsLoaded
    const pins = pinsLoaded
      ? pinSize({ zoom: this.map.getZoom(), latitude: this.map.getCenter().lat }, this.cardZoom()) === 'card'
        ? cardPins(this.map.querySourceFeatures(pinSource) as Feature<Point>[])
        : []
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
        // MapLibre owns the marker element's classes and transform, so the card goes inside it.
        const element = document.createElement('div')
        const button = document.createElement('button')
        button.type = 'button'
        element.append(button)
        element.addEventListener('click', (event) => {
          event.stopPropagation()
          this.onSelect(gameId)
        })
        // A mouse or pen on the card picks out its trail and venue dot; a touch has no hover (the
        // card's own hover look is CSS, for devices that hover). The card stays where it is.
        element.addEventListener('pointerenter', (event) => {
          if (event.pointerType !== 'touch') this.hover(gameId)
        })
        element.addEventListener('pointerleave', () => {
          if (this.hoveredGameId === gameId) this.hover(null)
        })
        // Above the venue, its trail down to it (see layOut); the city's name sits below its dot.
        const marker = new Marker({ element, anchor: 'bottom' })
        placed = {
          marker: marker.setLngLat(lngLat).addTo(this.map),
          drawn: '',
          drawnFrom: null,
          rows: [],
          width: 0,
          height: 0,
          offset: null,
          inCardCluster: false,
        }
        this.placed.set(gameId, placed)
        changed = true
      } else {
        // MapLibre moves the marker with the camera itself: setting it again only moves it again.
        const at = placed.marker.getLngLat()
        if (at.lng !== lngLat[0] || at.lat !== lngLat[1]) placed.marker.setLngLat(lngLat)
      }
      const from = placed.drawnFrom
      if (from?.game === game && from.color === color && from.flames === flames && from.selected === selected && from.theme === theme && from.scorer === scorer) continue
      placed.drawnFrom = { game, color, flames, selected, theme, scorer }
      const card = scoreCard(game)
      placed.marker.getElement().firstElementChild!.setAttribute('aria-label', gameLabel(game))
      const header = headerText(color, theme)
      const drawn = JSON.stringify({ card, color, header, selected, scorer })
      if (placed.drawn !== drawn) {
        const element = placed.marker.getElement()
        // Live cards draw on top, as Live small pins do; the selected card above all.
        element.style.zIndex = String(selected ? selectedStacking : stacking[card.status])
        const cardElement = element.firstElementChild as HTMLElement
        placed.rows = drawScoreCard(cardElement, card, { color, header }, selected, this.animating.get(gameId))
        spotlightScorer(placed.rows, game, scorer)
        placed.drawn = drawn
        placed.width = cardElement.offsetWidth
        placed.height = cardElement.offsetHeight
        changed = true
      }
    }

    // Having given up settling, the cards stay as the map last drew them and their trails, so the two
    // match, unless a card is new and has yet to be laid out (see GlobeSettling.holdsLayout).
    const held = this.settling.holdsLayout({ everyCardLaidOut: [...keep].every((gameId) => this.placed.get(gameId)!.offset) })
    if (!held && this.layOut(keep)) changed = true

    for (const [gameId, { marker }] of this.placed) {
      if (keep.has(gameId)) continue
      if (gameId === this.hoveredGameId) this.hover(null)
      this.releaseFocus(marker.getElement())
      marker.remove()
      this.placed.delete(gameId)
      this.animating.delete(gameId)
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

  /** Where the cards placed now are. */
  private placedPins(): CardPin[] {
    return [...this.placed].map(([gameId, { marker }]) => ({ gameId, lngLat: marker.getLngLat().toArray() }))
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
      const { marker, width, height } = this.placed.get(gameId)!
      const venue = this.map.project(marker.getLngLat())
      return { gameId, status: this.games.get(gameId)!.status, venueX: venue.x, venueY: venue.y, width, height }
    })
    this.mapSize ??= { width: this.map.getCanvas().clientWidth, height: this.map.getCanvas().clientHeight }
    const theme = this.theme()
    const scene: LayoutScene = {
      ...this.mapSize,
      venueGap: theme.components.ScoreCard.size.venueGap,
      names: this.placeNames.nameBoxes(),
      moving: this.moving,
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
      const offset = showing.as === 'card' ? showing.offset : noRoom
      if (offset.dx !== placed.offset?.dx || offset.dy !== placed.offset?.dy) {
        placed.offset = offset
        placed.marker.setOffset([offset.dx, offset.dy])
        placed.marker.getElement().toggleAttribute('data-moved', showing.as === 'card' && showing.moved)
      }
      const inCardCluster = showing.as !== 'card'
      if (inCardCluster !== placed.inCardCluster) {
        placed.inCardCluster = inCardCluster
        // Hidden rather than removed, so the card keeps its size for laying out the next frame.
        if (inCardCluster) this.releaseFocus(placed.marker.getElement())
        placed.marker.getElement().toggleAttribute('data-in-card-cluster', inCardCluster)
      }
    }
    const onGlobe = cards.map((card): CardOnGlobe => {
      const game = this.games.get(card.gameId)!
      return { ...card, lngLat: this.placed.get(card.gameId)!.marker.getLngLat().toArray(), color: this.colorOf(game), flames: game.hot }
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
    this.trails.show(trails)
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

  /** How a game shows on screen now, zoomed in (see cardLayout). */
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
      pulse(this.map, this.colorOf(game), placed.marker.getLngLat().toArray(), animation, 'pin')
      return true
    }
    const element = this.placed.get(gameId)?.marker.getElement().firstElementChild as HTMLElement | null | undefined
    if (!element) return false
    const playing = this.animating.get(gameId)
    if (playing) element.classList.remove(animationClass(playing))
    // Reading layout between removing and adding the class restarts an animation already playing.
    void element.offsetWidth
    this.animating.set(gameId, animation)
    element.classList.add(animationClass(animation))
    const ended = (event: AnimationEvent) => {
      // The score inside flashes too, and its end bubbles up here.
      if (event.target !== element) return
      element.removeEventListener('animationend', ended)
      if (this.animating.get(gameId) !== animation) return
      this.animating.delete(gameId)
      element.classList.remove(animationClass(animation))
    }
    element.addEventListener('animationend', ended)
    return true
  }

  /** Draws a game's trail and venue dot bolder, and the last game's no longer (see trailLayer). */
  private hover(gameId: string | null): void {
    this.hoveredGameId = gameId
    this.trails.hover(gameId)
  }

  private releaseFocus(element: HTMLElement): void {
    if (element.contains(document.activeElement)) focusGameNavigation(this.map.getCanvas())
  }

  clear(): void {
    this.hover(null)
    for (const { marker } of this.placed.values()) {
      this.releaseFocus(marker.getElement())
      marker.remove()
    }
    this.layout = cardLayout()
    this.cardClustersDrawn = []
    this.placed.clear()
    this.animating.clear()
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

const animationClass = (animation: PinAnimation) => `score-card--animate-${animation}`

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

function team({ label, logoUrl, score }: ScoreCardRow): HTMLElement {
  const row = document.createElement('div')
  row.className = 'score-card__team'
  row.append(logo({ label, logoUrl, score }), span('score-card__abbreviation', label), span('score-card__score', score))
  return row
}

function span(className: string, text: string): HTMLElement {
  const element = document.createElement('span')
  element.className = className
  element.textContent = text
  return element
}
