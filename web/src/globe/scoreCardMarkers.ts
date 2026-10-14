import { Marker, type GeoJSONSource, type Map as MapLibreMap } from 'maplibre-gl'
import type { Feature, Point } from 'geojson'
import type { Game } from '../games/game'
import type { Theme } from '../theme/theme'
import { cardPins, type CardPin } from './cardPins'
import { layOutCards, type CardLayout, type CardPlacement, type ScreenOffset } from './cardLayout'
import { cardLayoutFeatures, cardLayoutSource, hoveredState, type CardOnGlobe } from './cardLayoutLayers'
import type { PinAnimation } from './pinAnimation'
import { clusterReach, pinSource } from './pinLayers'
import type { PlaceNames } from './placeNames'
import { pulse } from './pinPulse'
import { isBehindGlobe } from './horizon'
import { traceLayout } from './layoutTrace'
import { scoreCard, type ScoreCard, type ScoreCardTeam } from './scoreCard'
import { selectedStacking, stacking, statusKey } from './statusLook'
import { hasCard, pinSize } from './zoomLevels'

// About a second of frames: longer than any layout takes to settle.
const maxSettlingFrames = 60

interface PlacedCard {
  marker: Marker
  /** The card last drawn into the marker, so unchanged cards aren't redrawn every frame. */
  drawn: string
  /** The card's size on screen, measured when it's drawn. */
  width: number
  height: number
  /**
   * Where the card sits from its venue: just above it, or moved aside to make room for others (see
   * cardLayout). Null until it's first laid out.
   */
  offset: ScreenOffset | null
  /** True while there's no room for the card and its game is counted in a card cluster instead. */
  inCardCluster: boolean
}

interface PlacedCardCluster {
  gameIds: string[]
  /** The first game's venue, where the card cluster is drawn. */
  lngLat: [number, number]
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
  private games = new Map<string, Game>()
  private selectedGameId: string | null = null
  /** The game whose card the pointer is on, if any: its trail and venue dot are drawn bolder (see cardLayoutLayers). */
  private hoveredGameId: string | null = null
  /** Cards mid-animation, so redrawing a card (say, with its new score) doesn't cut the animation short. */
  private readonly animating = new Map<string, PinAnimation>()
  private readonly map: MapLibreMap
  private readonly theme: () => Theme
  private readonly colourOf: (game: Game) => string
  private readonly placeNames: PlaceNames
  private readonly onSelect: (gameId: string) => void
  /** Games with no room for a card, as last laid out. */
  private cardClusters: PlacedCardCluster[] = []
  /** The layout last given to the map (see drawLayout), so it's given again only when it changes. */
  private layoutDrawn = ''
  /**
   * Whether the last sync changed any card (placed, redrawn, moved or removed), or couldn't yet read
   * the pins: until one changes nothing, the cards are still settling (see steady).
   */
  private changed = true
  /** How many syncs in a row have changed something, to stop asking for frames that never settle. */
  private changingSyncs = 0
  /**
   * Whether the cards have given up settling (see gaveUpSettling): until the next change from outside
   * (see settleAgain), they and their layout stay as the map last drew them.
   */
  private gaveUp = false

  /**
   * `theme` gives the theme as it is now, for how far above its venue a card sits; `colourOf` gives a
   * game's colour as it is now (see gameColour), for its card, its trail and its pulses over card
   * clusters; `placeNames` gives the names cards keep clear of; `onSelect` is called with a game's id
   * when its card is selected.
   */
  constructor(
    map: MapLibreMap,
    theme: () => Theme,
    colourOf: (game: Game) => string,
    placeNames: PlaceNames,
    onSelect: (gameId: string) => void,
  ) {
    this.map = map
    this.theme = theme
    this.colourOf = colourOf
    this.placeNames = placeNames
    this.onSelect = onSelect
    // The camera moving (a pan, a zoom, a resize) moves the cards on screen: they settle afresh.
    map.on('move', this.settleAgain)
  }

  /** Highlights the selected game's card, if it has one. */
  setSelected(gameId: string | null): void {
    this.selectedGameId = gameId
    this.settleAgain()
    this.sync()
  }

  /**
   * After a change of theme, with the page's CSS already in it, or of the games' colours: each card
   * redrawn in its game's colour, measured afresh, as its text, spacing and sizes may have changed,
   * and laid out again.
   */
  restyle(): void {
    for (const placed of this.placed.values()) {
      const cardElement = placed.marker.getElement().firstElementChild as HTMLElement
      placed.width = cardElement.offsetWidth
      placed.height = cardElement.offsetHeight
    }
    this.settleAgain()
    this.sync()
  }

  /** Where a game's card is on the page, if it has one. */
  cardOnPage(gameId: string): DOMRect | null {
    const element = this.placed.get(gameId)?.marker.getElement().firstElementChild
    return element ? element.getBoundingClientRect() : null
  }

  setGames(games: readonly Game[]): void {
    this.games = new Map(games.map((game) => [game.id, game]))
    this.settleAgain()
    this.sync()
  }

  /**
   * Places, updates and removes cards to match what the pin source shows at the current zoom, on the
   * side of the globe facing the viewer, for games near the centre of the view (see hasCard).
   */
  sync(): void {
    if (!this.map.getSource(pinSource)) return
    const pinsLoaded = this.map.isSourceLoaded(pinSource)
    let changed = !pinsLoaded
    const pins = pinsLoaded
      ? pinSize(this.map.getZoom()) === 'card'
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
      const card = scoreCard(game)
      const color = this.colourOf(game)
      const selected = gameId === this.selectedGameId
      const drawn = JSON.stringify({ card, color, selected })
      let placed = this.placed.get(gameId)
      if (!placed) {
        // MapLibre owns the marker element's classes and transform, so the card goes inside it.
        const element = document.createElement('div')
        element.append(document.createElement('div'))
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
          width: 0,
          height: 0,
          offset: null,
          inCardCluster: false,
        }
        this.placed.set(gameId, placed)
        changed = true
      } else {
        placed.marker.setLngLat(lngLat)
      }
      if (placed.drawn !== drawn) {
        const element = placed.marker.getElement()
        // Live cards draw on top, as Live small pins do; the selected card above all.
        element.style.zIndex = String(selected ? selectedStacking : stacking[card.status])
        const cardElement = element.firstElementChild as HTMLElement
        drawScoreCard(cardElement, card, color, selected, this.animating.get(gameId))
        placed.drawn = drawn
        placed.width = cardElement.offsetWidth
        placed.height = cardElement.offsetHeight
        changed = true
      }
    }

    // Having given up settling, the cards stay as the map last drew them and their trails, so the two
    // match, unless a card is new and has yet to be laid out.
    const frozen = this.gaveUp && [...keep].every((gameId) => this.placed.get(gameId)!.offset)
    if (this.gaveUp && !frozen) this.settleAgain()
    if (!frozen && this.layOut(keep)) changed = true

    for (const [gameId, { marker }] of this.placed) {
      if (keep.has(gameId)) continue
      if (gameId === this.hoveredGameId) this.hover(null)
      marker.remove()
      this.placed.delete(gameId)
      this.animating.delete(gameId)
      changed = true
    }
    // Still unsettled, but asking for no frames: the map can go idle.
    if (frozen) return
    this.settleNextFrame(changed, pinsLoaded)
  }

  /**
   * Whether the cards have settled: the last frame laid them out just as the frame before did, with
   * the pins they're placed from loaded.
   */
  steady(): boolean {
    return !this.changed
  }

  /**
   * Whether the cards have given up settling: their layout was still changing after as many frames as
   * any layout takes to settle (see settleNextFrame). Until the next change from outside (a pan or
   * zoom, new or changed games, or a selection), they ask for no more frames and give the map no new
   * layout, staying just as the map last drew them and their trails, unsettled, so the map can go idle.
   */
  gaveUpSettling(): boolean {
    return this.gaveUp
  }

  /** After a change from outside: a fresh layout, given to the map, and a full second to settle. */
  private readonly settleAgain = () => {
    this.gaveUp = false
    this.changingSyncs = 0
    this.layoutDrawn = ''
  }

  /**
   * Each frame's layout starts from the last, and the map draws a frame only when something on it
   * changes: so while the cards are still moving, ask for another frame, until they settle (for a
   * second at most, should a layout never settle: then they give up, see gaveUpSettling).
   */
  private settleNextFrame(changed: boolean, pinsLoaded: boolean): void {
    this.changed = changed
    this.changingSyncs = changed ? this.changingSyncs + 1 : 0
    if (!changed) return
    if (this.changingSyncs <= maxSettlingFrames) this.map.triggerRepaint()
    // Pins still loading aren't the layout failing to settle: they'll draw frames of their own.
    else if (pinsLoaded) this.gaveUp = true
  }

  /** Where the cards placed now are. */
  private placedPins(): CardPin[] {
    return [...this.placed].map(([gameId, { marker }]) => ({ gameId, lngLat: marker.getLngLat().toArray() }))
  }

  /**
   * Moves cards that would overlap apart, each with a trail back to its venue, and counts the games
   * there's no room for (see cardLayout). True if any card moved, or went into or out of a card cluster.
   */
  private layOut(gameIds: ReadonlySet<string>): boolean {
    const cards = [...gameIds].map((gameId): CardOnGlobe => {
      const { marker, width, height } = this.placed.get(gameId)!
      const lngLat = marker.getLngLat()
      const venue = this.map.project(lngLat)
      const game = this.games.get(gameId)!
      return {
        gameId,
        status: game.status,
        venueX: venue.x,
        venueY: venue.y,
        width,
        height,
        lngLat: lngLat.toArray(),
        color: this.colourOf(game),
      }
    })
    // Where the cards were last frame, so they stay put while they still have room.
    const previous = new Map<string, CardPlacement>()
    for (const gameId of gameIds) {
      const { offset, inCardCluster } = this.placed.get(gameId)!
      if (offset) previous.set(gameId, { offset, inCardCluster, moved: false, trail: null })
    }
    const canvas = this.map.getCanvas()
    const scene = {
      width: canvas.clientWidth,
      height: canvas.clientHeight,
      venueGap: this.theme().components.ScoreCard.size.venueGap,
      names: this.placeNames.nameBoxes(),
    }
    traceLayout({ cards: cards.map(({ lngLat: _lngLat, color: _color, ...card }) => card), scene })
    const layout = layOutCards(cards, scene, previous)

    let moved = false
    for (const [gameId, placed] of this.placed) {
      const placement = layout.cards.get(gameId)
      if (!placement) continue
      const { offset, inCardCluster, moved: movedAside } = placement
      if (offset.dx !== placed.offset?.dx || offset.dy !== placed.offset?.dy) {
        placed.offset = offset
        placed.marker.setOffset([offset.dx, offset.dy])
        placed.marker.getElement().toggleAttribute('data-moved', movedAside)
        moved = true
      }
      if (inCardCluster !== placed.inCardCluster) {
        placed.inCardCluster = inCardCluster
        // Hidden rather than removed, so the card keeps its size for laying out the next frame.
        placed.marker.getElement().toggleAttribute('data-in-card-cluster', inCardCluster)
        moved = true
      }
    }
    const lngLats = new Map(cards.map((card) => [card.gameId, card.lngLat]))
    this.cardClusters = layout.cardClusters.map(({ gameIds }) => ({ gameIds, lngLat: lngLats.get(gameIds[0])! }))
    this.drawLayout(cards, layout)
    return moved
  }

  /**
   * Gives the map the trails, card clusters and footprints of a layout (see cardLayoutLayers), when
   * they've changed: as the globe turns, they move on screen with it.
   */
  private drawLayout(cards: readonly CardOnGlobe[], layout: CardLayout): void {
    const source = this.map.getSource<GeoJSONSource>(cardLayoutSource)
    if (!source) return
    // To the pixel: finer changes don't show.
    const drawn = JSON.stringify([cards, [...layout.cards], layout.cardClusters], (_key, value: unknown) =>
      typeof value === 'number' ? Math.round(value) : value,
    )
    if (drawn === this.layoutDrawn) return
    this.layoutDrawn = drawn
    const theme = this.theme()
    const { ring } = theme.components.Trail.venue
    const unproject = (x: number, y: number) => this.map.unproject([x, y]).toArray()
    const venueSizes = { dot: ring.radius + ring.width, cluster: (count: number) => clusterReach(theme, count) }
    void source.setData(cardLayoutFeatures(cards, layout, unproject, venueSizes))
  }

  /** The games in each card cluster on screen now. */
  cardClusterGames(): string[][] {
    return this.cardClusters.map((cardCluster) => cardCluster.gameIds)
  }

  /** The games in the card cluster on screen now that's drawn at this game's venue, the first in it. */
  cardClusterOf(firstGameId: string): string[] | undefined {
    return this.cardClusters.find(({ gameIds }) => gameIds[0] === firstGameId)?.gameIds
  }

  /**
   * Plays an animation on a game's card, or over the count it's in when there's no room for its
   * card. False when the game has neither on screen.
   */
  animate(gameId: string, animation: PinAnimation): boolean {
    const cardCluster = this.cardClusters.find(({ gameIds }) => gameIds.includes(gameId))
    const game = this.games.get(gameId)
    if (cardCluster && game) {
      pulse(this.map, this.colourOf(game), cardCluster.lngLat, animation, 'cluster')
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

  /**
   * Marks a game's trail and venue dot hovered on the map, and the last game's no longer: the map's
   * feature state, which the trail layers read, so the layout and its trails aren't drawn again.
   */
  private hover(gameId: string | null): void {
    const was = this.hoveredGameId
    this.hoveredGameId = gameId
    if (!this.map.getSource(cardLayoutSource)) return
    if (was !== null) this.map.setFeatureState({ source: cardLayoutSource, id: was }, { [hoveredState]: false })
    if (gameId !== null) this.map.setFeatureState({ source: cardLayoutSource, id: gameId }, { [hoveredState]: true })
  }

  clear(): void {
    this.hover(null)
    for (const { marker } of this.placed.values()) marker.remove()
    this.cardClusters = []
    this.placed.clear()
    this.animating.clear()
  }
}

const animationClass = (animation: PinAnimation) => `score-card--animate-${animation}`

function drawScoreCard(element: HTMLElement, card: ScoreCard, color: string, selected: boolean, animation?: PinAnimation): void {
  element.className = `score-card score-card--${statusKey(card.status)}`
  // In its game's colour, in place of its status's from the page's CSS.
  element.style.setProperty('--status-card-color', color)
  element.classList.toggle('score-card--selected', selected)
  if (animation) element.classList.add(animationClass(animation))
  element.dataset.gameId = card.gameId
  // A header strip with a status light and the clock (or the status), then the teams.
  const header = document.createElement('div')
  header.className = 'score-card__header'
  header.append(span('score-card__light', ''), span('score-card__clock', card.clockLine || card.status))
  element.replaceChildren(header, team(card.away), team(card.home))
}

function logo({ logoUrl }: ScoreCardTeam): HTMLImageElement {
  const image = document.createElement('img')
  image.className = 'score-card__logo'
  image.alt = ''
  if (logoUrl) image.src = logoUrl
  else image.style.visibility = 'hidden'
  return image
}

function team({ abbreviation, logoUrl, score }: ScoreCardTeam): HTMLElement {
  const row = document.createElement('div')
  row.className = 'score-card__team'
  row.append(logo({ abbreviation, logoUrl, score }), span('score-card__abbreviation', abbreviation), span('score-card__score', score))
  return row
}

function span(className: string, text: string): HTMLElement {
  const element = document.createElement('span')
  element.className = className
  element.textContent = text
  return element
}
