import { gameLabel } from '../games/gameLabel'
import type { GeoJSONSource, Map as MapLibreMap } from 'maplibre-gl'
import type { Feature, Point } from 'geojson'
import type { Game } from '../games/game'
import type { PlacedGame } from '../games/placedGames'
import { sidesTopFirst } from '../games/sides'
import { logoFailed, shownLogo } from '../games/teamLogo'
import { noneJustHappened, scorerOf, type JustHappened } from '../games/justHappened'
import type { PinnedCards } from '../games/pinnedCards'
import { spotlightElapsed, type Scorer } from '../games/scorers'
import { statusKey, type Theme } from '../theme/theme'
import type { CardCount, CardPositionPriority } from '../settings/viewerSettings'
import { cardPins } from './cardPins'
import type { CardLayout, Showing, VenueSizes } from './cardLayout'
import { cardClusterReach, cardLayoutDrawing, cardLayoutSource, type CardOnGlobe, type DrawnCardCluster } from './cardLayoutLayers'
import type { PinAnimation } from './pinAnimation'
import { PlacedCard, animationClass } from './placedCard'
import { confettiOnCard } from '../celebration/celebration'
import { teamColors } from '../celebration/teamColors'
import { pinSource } from './pinLayers'
import type { PlaceNames } from './placeNames'
import { pulse } from './pinPulse'
import { isBehindGlobe } from './horizon'
import { traceLayout } from './layoutTrace'
import type { GlobeSettling } from './globeSettling'
import { headerText, scoreCard, type ScoreCard, type ScoreCardRow } from './scoreCard'
import type { TrailLayer, TrailOnGlobe } from './trailLayer'
import { cardDotAt } from './cardDot'
import { selectedStacking, stacking } from './statusLook'
import { scoreCardScene, type CardLaidOut, type CardsOnPage, type ScoreCardScene } from './scoreCardScene'

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
  /** Its rows, top first: for an arrow to end level with. */
  rows: Element[]
}

/**
 * At every zoom, shows each pin near the center of the view as an HTML score card (logos,
 * abbreviations, score, clock line). Cards that would overlap are moved apart with a trail back to
 * their venue; where there's no room for them all, the rest are shown as a card cluster. The trails
 * and card clusters are drawn by the map, beneath the place names (see cardLayoutLayers).
 *
 * Which games have cards, and what becomes of them each frame, is the score card scene's (see
 * ScoreCardScene): this tells it what happens on the map, and applies what it decides to the page's
 * elements and to MapLibre.
 */
export class ScoreCardMarkers {
  private readonly placed = new Map<string, PlacedCard>()
  /** Cards going out, as the scene has them go (see ScoreCardScene). */
  private readonly goingOut = new Map<string, PlacedCard>()
  private games = new Map<string, PlacedGame>()
  private justHappened: JustHappened = noneJustHappened
  private selectedGameId: string | null = null
  /** The game whose card the pointer is on, if any: its trail and venue dot are drawn bolder (see cardLayoutLayers). */
  private hoveredGameId: string | null = null
  /** Whether the viewer asks for less motion: cards then go straight where they're moved. */
  private readonly reducedMotion = matchMedia('(prefers-reduced-motion: reduce)')
  private readonly map: MapLibreMap
  private readonly theme: () => Theme
  private readonly colorOf: (game: Game) => string
  /** Whether a game's card shows the hot indicator now (see GlobeMap.setHotIndicators). */
  private readonly hotIndicatorOf: (game: Game) => boolean
  private readonly placeNames: PlaceNames
  private readonly trails: TrailLayer
  private readonly onSelect: (gameId: string) => void
  /** Which games have cards, and what becomes of them each frame (see ScoreCardScene). */
  private readonly scene: ScoreCardScene
  private readonly scoreCardPins?: PinnedCards
  /** The card clusters as last drawn, for pulses over them (see cardLayoutDrawing). */
  private cardClustersDrawn: DrawnCardCluster[] = []
  /**
   * The layout last given to the map (see drawLayout), so it's given again only when it changes: its
   * features with the points worked out on screen left blank, and where on the globe those points were put.
   */
  private layoutDrawn: { shape: string; lngLats: [number, number][]; footprints: number[][] } = { shape: '', lngLats: [], footprints: [] }
  /**
   * The map's size on screen, until it's resized: reading it from the page each frame would have the
   * browser work out the cards' styles, just moved, there and then.
   */
  private mapSize: { width: number; height: number } | null = null

  /**
   * `theme` gives the theme as it is now, for how far above its venue a card sits; `colorOf` gives a
   * game's color as it is now (see gameColor), for its card, its trail and its pulses over card
   * clusters; `hotIndicatorOf` whether a game shows the hot indicator now, on its card and the clusters it's in; `placeNames` gives the names cards keep clear of; `trails` draws the moved cards'
   * trails; `onSelect` is called with a game's id when its card is selected; `settling` is the
   * globe's settling, which the cards report to and which says when to ask for a frame; `cardCount`
   * says how many cards show at once where it's busy, until setCardCount.
   */
  constructor(
    map: MapLibreMap,
    theme: () => Theme,
    colorOf: (game: Game) => string,
    hotIndicatorOf: (game: Game) => boolean,
    placeNames: PlaceNames,
    trails: TrailLayer,
    onSelect: (gameId: string) => void,
    settling: GlobeSettling,
    cardCount: CardCount,
    cardPositionPriority: CardPositionPriority,
    scoreCardPins?: PinnedCards,
  ) {
    this.map = map
    this.theme = theme
    this.colorOf = colorOf
    this.hotIndicatorOf = hotIndicatorOf
    this.placeNames = placeNames
    this.trails = trails
    this.onSelect = onSelect
    this.scoreCardPins = scoreCardPins
    this.scene = scoreCardScene({
      page: this.page,
      settling,
      cardCount,
      cardPositionPriority,
      reducedMotion: () => this.reducedMotion.matches,
      laidOut: traceLayout,
    })
    if (scoreCardPins) {
      this.scene.setPinned(scoreCardPins.games())
      const unsubscribe = scoreCardPins.subscribe(() => {
        this.scene.setPinned(scoreCardPins.games())
        this.sync()
      })
      map.once('remove', unsubscribe)
    }
    // The camera moving (a pan, a zoom, a resize) moves the cards on screen: they settle afresh.
    map.on('move', this.cameraMoved)
    // Once the camera stops, the cards settle as for a still camera (see CardScene.cameraMoving).
    map.on('moveend', this.cameraStopped)
    map.on('resize', this.resized)
  }

  /** Shows as many cards at once as this card count allows (see mostCards), laid out afresh. */
  setCardCount(count: CardCount): void {
    if (this.scene.setCardCount(count)) this.sync()
  }

  setCardPositionPriority(priority: CardPositionPriority): void {
    this.scene.setCardPositionPriority(priority)
  }

  /** Highlights the selected game's card and its trail, if it has them. */
  setSelected(gameId: string | null): void {
    this.selectedGameId = gameId
    this.trails.select(gameId)
    this.scene.select(gameId)
    this.sync()
  }

  /**
   * After a change of theme, with the page's CSS already in it, or of the games' colors: each card redrawn in its game's color, measured afresh, as its text, spacing
   * and sizes may have changed, and laid out afresh, as the cards held where they were would overlap.
   */
  restyle(): void {
    for (const placed of this.placed.values()) placed.measureAfresh()
    this.scene.restyled()
    this.sync()
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
    this.scene.showGames(games)
    this.sync()
  }

  /**
   * Shows the score card scene a frame of the map (see ScoreCardScene.frame): the pins as the pin
   * source has them, if it can be read, and where their venues are on screen.
   */
  sync(): void {
    const map = this.map
    if (!map.getSource(pinSource)) return
    const pins = map.isSourceLoaded(pinSource) ? cardPins(map.querySourceFeatures(pinSource) as Feature<Point>[]) : null
    const after = this.scene.frame({
      pins,
      behindGlobe: (lngLat) => isBehindGlobe(map, lngLat),
      onScreen: (lngLat) => {
        const canvas = map.getCanvas()
        const { x, y } = map.project(lngLat)
        return x >= 0 && y >= 0 && x <= canvas.clientWidth && y <= canvas.clientHeight
      },
      venue: (lngLat) => map.project(lngLat),
      screen: () => (this.mapSize ??= { width: map.getCanvas().clientWidth, height: map.getCanvas().clientHeight }),
      layoutScene: () => {
        const theme = this.theme()
        return {
          venueGap: theme.components.ScoreCard.size.venueGap,
          names: this.placeNames.layOutCityNames(),
          cameraMoving: map.isMoving(),
          venueSizes: venueSizes(theme),
        }
      },
    })
    if (after === 'askForFrame') map.triggerRepaint()
  }

  private readonly resized = () => (this.mapSize = null)

  private readonly cameraMoved = () => this.scene.cameraMoved()

  private readonly cameraStopped = () => {
    this.scene.cameraStopped()
    this.map.triggerRepaint()
  }

  /** The cards on the page and the map, as the score card scene has them (see CardsOnPage). */
  private readonly page: CardsOnPage = {
    place: (gameId, lngLat) => {
      this.placed.set(
        gameId,
        new PlacedCard(this.map, gameId, lngLat, {
          select: () => this.onSelect(gameId),
          hover: (on) => {
            if (on) this.hover(gameId)
            else if (this.hoveredGameId === gameId) this.hover(null)
          },
        }),
      )
    },
    comeIn: (gameId) => this.placed.get(gameId)!.comeIn(this.comingsOver),
    appear: (gameId, since) => this.placed.get(gameId)!.appear(since, this.comingsOver),
    cameIn: (gameId) => this.placed.get(gameId)?.cameIn(),
    moveTo: (gameId, lngLat) => this.placed.get(gameId)!.moveTo(lngLat),
    draw: (gameId, game) => this.draw(this.placed.get(gameId)!, gameId, game),
    size: (gameId) => this.placed.get(gameId)!,
    placeAt: (gameId, { offset, moved, glide, inCardCluster }) => {
      const placed = this.placed.get(gameId)!
      placed.placeAt(offset, moved)
      if (glide) placed.glide(glide)
      placed.setInCardCluster(inCardCluster)
    },
    drawLayout: (cards, layout, moving) => this.drawLayout(cards, layout, moving),
    showTrails: (trails) => this.trails.show(trails),
    goOut: (gameId, since, trail, outOfView) => {
      const placed = this.takeOff(gameId)!
      placed.goOut(since, trail, this.comingsOver, outOfView)
      this.goingOut.set(gameId, placed)
    },
    dispose: (gameId) => this.takeOff(gameId)?.dispose(),
    removeGoingOut: (gameId) => {
      this.goingOut.get(gameId)?.dispose()
      this.goingOut.delete(gameId)
    },
  }

  private readonly comingsOver = () => this.scene.comingsOver()

  /** Draws a card for its game as it is now, if anything it's drawn from has changed: true if it was redrawn. */
  private draw(placed: PlacedCard, gameId: string, game: PlacedGame): boolean {
    if (this.scoreCardPins) {
      if (!placed.element.hasAttribute('data-pinnable')) placed.element.setAttribute('data-pinnable', '')
      const pinned = this.scoreCardPins.games().includes(gameId)
      if (placed.element.hasAttribute('data-pinned') !== pinned) {
        placed.element.toggleAttribute('data-pinned', pinned)
        if (pinned) placed.element.setAttribute('aria-description', 'Pinned score card')
        else placed.element.removeAttribute('aria-description')
      }
    }
    const color = this.colorOf(game)
    const hotIndicator = this.hotIndicatorOf(game)
    const selected = gameId === this.selectedGameId
    const theme = this.theme()
    const scorer = scorerOf(this.justHappened, gameId)
    const from = placed.drawnFrom
    if (from?.game === game && from.color === color && from.hotIndicator === hotIndicator && from.selected === selected && from.theme === theme && from.scorer === scorer) return false
    placed.drawnFrom = { game, color, hotIndicator, selected, theme, scorer }
    const card = { ...scoreCard(game), hotIndicator }
    placed.element.setAttribute('aria-label', gameLabel(game))
    const header = headerText(color, theme)
    const drawn = JSON.stringify({ card, color, header, selected, scorer })
    if (placed.drawn === drawn) return false
    // Live cards draw on top, as Live small pins do; the selected card above all.
    placed.markerElement.style.zIndex = String(selected ? selectedStacking : stacking[card.status])
    placed.rows = drawScoreCard(placed.element, card, { color, header }, selected, placed.animation)
    spotlightScorer(placed.rows, game, scorer)
    placed.drawn = drawn
    placed.measure()
    return true
  }

  /**
   * Gives the trail layer the moved cards' trails, and the map the venue clusters, card clusters and
   * footprints of a layout (see cardLayoutLayers), when they've changed. The trail layer draws the
   * trails each frame where the cards are then. The rest are places on the globe, so as it turns they
   * move on screen with it: they're given again only when the layout changes, or the globe turning
   * has carried a point worked out on screen (a venue cluster's, between its venues) or a footprint
   * off where it should be. Giving them again sends them to MapLibre's worker to be made into tiles,
   * too slow for every frame of a pan. Gives back the moved cards' trails, or null if the map has no
   * source for the layout yet.
   */
  private drawLayout(laidOut: readonly CardLaidOut[], layout: CardLayout, moving: boolean): TrailOnGlobe[] | null {
    const cards = laidOut.map((card): CardOnGlobe => {
      const game = this.games.get(card.gameId)!
      return { ...card, color: this.colorOf(game), hotIndicator: this.hotIndicatorOf(game) }
    })
    // Each point worked out on screen, by the place on the globe it was turned into.
    const onScreen = new Map<[number, number], [number, number]>()
    const unproject = (x: number, y: number) => {
      const lngLat = this.map.unproject([x, y]).toArray()
      onScreen.set(lngLat, [x, y])
      return lngLat
    }
    const { source: features, trails, cardClusters } = cardLayoutDrawing(cards, layout, unproject, this.theme())
    this.cardClustersDrawn = cardClusters
    const source = this.map.getSource<GeoJSONSource>(cardLayoutSource)
    if (!source) return null
    // A dot on each card where its trail meets it, so it's plain which card a trail is.
    const starts = new Map(trails.map(({ gameId, start }) => [gameId, start]))
    for (const { gameId } of cards) {
      const placed = this.placed.get(gameId)
      const start = starts.get(gameId)
      placed?.showTrailDot(start && placed.offset ? cardDotAt(start, placed.offset, placed) : null)
    }
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
    if (!held) {
      void source.setData(features)
      this.layoutDrawn = { shape, lngLats: [...onScreen.keys()], footprints }
    }
    return trails
  }

  /** Takes a game's card off the layout, its hover with it, for it to be disposed or go out: the one way a card laid out leaves. */
  private takeOff(gameId: string): PlacedCard | undefined {
    const placed = this.placed.get(gameId)
    if (!placed) return undefined
    if (gameId === this.hoveredGameId) this.hover(null)
    this.placed.delete(gameId)
    return placed
  }

  /** How a game shows on screen now (see cardLayout). */
  shows(gameId: string): Showing {
    return this.scene.shows(gameId)
  }

  reveal(gameIds: readonly string[]): void {
    this.scene.reveal(gameIds)
    this.sync()
  }


  /**
   * Plays an animation on a game's card, or when there's no room for its card, over the count it's
   * in or its small pin. False when the game has none of them on screen.
   */
  animate(gameId: string, animation: PinAnimation): boolean {
    // A game whose card is on screen animates its card, though its trail meets at a card cluster.
    const showing = this.scene.shows(gameId)
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

  /**
   * Plays a game's celebration on its score card as it finishes (see GLOSSARY.md "Celebration"):
   * confetti in its teams' colors, kept to the card. Only a card on screen celebrates; a game in a card
   * cluster or on a small pin doesn't.
   */
  celebrate(gameId: string): void {
    const game = this.games.get(gameId)
    const placed = this.placed.get(gameId)
    if (!game || !placed || this.scene.shows(gameId).as !== 'card') return
    // In the color it played in, not Final's.
    void teamColors(game, this.colorOf({ ...game, status: 'Live' })).then((colors) => {
      if (this.placed.get(gameId) === placed) confettiOnCard(placed.element, placed.markerElement, colors)
    })
  }

  /** Draws a game's trail and venue dot bolder, and the last game's no longer (see trailLayer). */
  private hover(gameId: string | null): void {
    this.hoveredGameId = gameId
    this.trails.hover(gameId)
  }

  clear(): void {
    this.scene.clear()
    this.hover(null)
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
    cardCluster: cardClusterReach(theme),
  }
}

/** A score card's colors: its game's (see gameColor), and its header's text, readable on its tint (see headerText). */
interface CardColors {
  color: string
  header: string
}

/** Draws a score card into its element, giving its rows, top first. */
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
  const rows = card.rows.map(team)
  element.replaceChildren(header, ...rows)
  if (card.hotIndicator) element.append(hotIndicatorElement())
  // Where its trail meets it, put there by its placed card (see showTrailDot).
  element.append(span('score-card__trail-dot', ''))
  return rows
}

/** The hot indicator around a hot game's card, a glowing outline shaped and animated by the CSS. */
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

function hotIndicatorElement(): HTMLElement {
  const outline = span('score-card__hot-indicator', '')
  outline.setAttribute('aria-hidden', 'true')
  return outline
}

/**
 * A row's logo on its plate; with no logo, or once it fails to load, a team's mark on the plate (see
 * logoMark), and for an entrant or a bout's side with no flag, an empty space.
 */
function logo({ logoUrl, mark }: ScoreCardRow): HTMLElement {
  const url = shownLogo(logoUrl)
  if (!url) return noLogo(mark)
  const image = document.createElement('img')
  image.className = 'score-card__logo'
  image.alt = ''
  image.addEventListener('error', () => {
    logoFailed(url)
    image.replaceWith(noLogo(mark))
  }, { once: true })
  image.src = url
  return image
}

function noLogo(mark: string | undefined): HTMLElement {
  if (mark) {
    const stand = span('score-card__logo score-card__logo--mark', mark)
    stand.setAttribute('aria-hidden', 'true')
    return stand
  }
  const space = span('score-card__logo', '')
  space.style.visibility = 'hidden'
  return space
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
