import { Marker, type GeoJSONSource, type Map as MapLibreMap } from 'maplibre-gl'
import type { Feature, Point } from 'geojson'
import type { Game } from '../games/game'
import { cardPins, type CardPin } from './cardPins'
import { defaultCardStyle, type CardStyle } from './cardStyle'
import { layOutCards, type CardLayout, type CardPlacement, type ScreenOffset } from './cardLayout'
import { cardLayoutFeatures, cardLayoutSource, type CardOnGlobe } from './cardLayoutLayers'
import type { PinAnimation } from './pinAnimation'
import { pinSource } from './pinLayers'
import type { PlaceNames } from './placeNames'
import { pulse } from './pinPulse'
import { isBehindGlobe } from './horizon'
import { scoreCard, type ScoreCard, type ScoreCardTeam } from './scoreCard'
import { selectedStacking, statusLooks } from './statusLook'
import { pinLayout } from './zoomLevels'

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
  /** Cards mid-animation, so redrawing a card (say, with its new score) doesn't cut the animation short. */
  private readonly animating = new Map<string, PinAnimation>()
  private readonly map: MapLibreMap
  private readonly placeNames: PlaceNames
  private readonly onSelect: (gameId: string) => void
  /** Games with no room for a card, as last laid out. */
  private cardClusters: PlacedCardCluster[] = []
  /** The layout last given to the map (see drawLayout), so it's given again only when it changes. */
  private layoutDrawn = ''
  /** How far a card's pointer reaches below it, read from the first card drawn (see cardPointer). */
  private pointer = 0
  private style: CardStyle = defaultCardStyle

  /**
   * `placeNames` gives the names cards keep clear of; `onSelect` is called with a game's id when its
   * card is selected.
   */
  constructor(map: MapLibreMap, placeNames: PlaceNames, onSelect: (gameId: string) => void) {
    this.map = map
    this.placeNames = placeNames
    this.onSelect = onSelect
  }

  /** The "Card style" setting: redraws every card in the style picked. */
  setStyle(style: CardStyle): void {
    if (style === this.style) return
    this.style = style
    // The pointer may differ between styles, so it's read again from the next card drawn.
    this.pointer = 0
    this.sync()
  }

  /** Highlights the selected game's card, if it has one. */
  setSelected(gameId: string | null): void {
    this.selectedGameId = gameId
    this.sync()
  }

  /** Where a game's card is on the page, if it has one. */
  cardOnPage(gameId: string): DOMRect | null {
    const element = this.placed.get(gameId)?.marker.getElement().firstElementChild
    return element ? element.getBoundingClientRect() : null
  }

  setGames(games: readonly Game[]): void {
    this.games = new Map(games.map((game) => [game.id, game]))
    this.sync()
  }

  /**
   * Places, updates and removes cards to match what the pin source shows at the current zoom, on the
   * side of the globe facing the viewer.
   */
  sync(): void {
    if (!this.map.getSource(pinSource)) return
    const pins = this.map.isSourceLoaded(pinSource)
      ? pinLayout(this.map.getZoom()).size === 'card'
        ? cardPins(this.map.querySourceFeatures(pinSource) as Feature<Point>[])
        : []
      : // The source reloads after every change of games, and can't be read until it has. Live games
        // can change faster than it loads, so meanwhile the cards placed stay put but still show
        // each change.
        this.placedPins()
    // A venue behind the globe gets no card, rather than one MapLibre fades (and its trail and
    // room in the layout with it): cards pop in and out as their venues cross the horizon.
    const wanted = pins.filter(({ lngLat }) => !isBehindGlobe(this.map, lngLat))

    const keep = new Set<string>()
    for (const { gameId, lngLat } of wanted) {
      const game = this.games.get(gameId)
      if (!game) continue
      keep.add(gameId)
      const card = scoreCard(game)
      const selected = gameId === this.selectedGameId
      const drawn = JSON.stringify({ card, selected, style: this.style })
      let placed = this.placed.get(gameId)
      if (!placed) {
        // MapLibre owns the marker element's classes and transform, so the card goes inside it.
        const element = document.createElement('div')
        element.append(document.createElement('div'))
        element.addEventListener('click', (event) => {
          event.stopPropagation()
          this.onSelect(gameId)
        })
        // Above the venue, its pointer's tip on the spot (see layOut); the city's name sits below its dot.
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
      } else {
        placed.marker.setLngLat(lngLat)
      }
      if (placed.drawn !== drawn) {
        const element = placed.marker.getElement()
        // Live cards draw on top, as Live small pins do; the selected card above all.
        element.style.zIndex = String(selected ? selectedStacking : statusLooks[card.status].stacking)
        const cardElement = element.firstElementChild as HTMLElement
        drawScoreCard(cardElement, card, selected, this.style, this.animating.get(gameId))
        this.pointer ||= cardPointer(cardElement)
        placed.drawn = drawn
        placed.width = cardElement.offsetWidth
        placed.height = cardElement.offsetHeight
      }
    }

    this.layOut(keep)

    for (const [gameId, { marker }] of this.placed) {
      if (keep.has(gameId)) continue
      marker.remove()
      this.placed.delete(gameId)
      this.animating.delete(gameId)
    }
  }

  /** Where the cards placed now are. */
  private placedPins(): CardPin[] {
    return [...this.placed].map(([gameId, { marker }]) => ({ gameId, lngLat: marker.getLngLat().toArray() }))
  }

  /**
   * Moves cards that would overlap apart, each with a trail back to its venue, and counts the games
   * there's no room for (see cardLayout).
   */
  private layOut(gameIds: ReadonlySet<string>): void {
    const cards = [...gameIds].map((gameId): CardOnGlobe => {
      const { marker, width, height } = this.placed.get(gameId)!
      const lngLat = marker.getLngLat()
      const venue = this.map.project(lngLat)
      const { status } = this.games.get(gameId)!
      return { gameId, status, venueX: venue.x, venueY: venue.y, width, height, lngLat: lngLat.toArray() }
    })
    // Where the cards were last frame, so they stay put while they still have room.
    const previous = new Map<string, CardPlacement>()
    for (const gameId of gameIds) {
      const { offset, inCardCluster } = this.placed.get(gameId)!
      if (offset) previous.set(gameId, { offset, inCardCluster, trail: null })
    }
    const canvas = this.map.getCanvas()
    const layout = layOutCards(
      cards,
      { width: canvas.clientWidth, height: canvas.clientHeight, pointer: this.pointer, names: this.placeNames.nameBoxes() },
      previous,
    )

    for (const [gameId, placed] of this.placed) {
      const placement = layout.cards.get(gameId)
      if (!placement) continue
      const { offset, inCardCluster, trail } = placement
      if (offset.dx !== placed.offset?.dx || offset.dy !== placed.offset?.dy) {
        placed.offset = offset
        placed.marker.setOffset([offset.dx, offset.dy])
        placed.marker.getElement().toggleAttribute('data-moved', trail !== null)
      }
      if (inCardCluster !== placed.inCardCluster) {
        placed.inCardCluster = inCardCluster
        // Hidden rather than removed, so the card keeps its size for laying out the next frame.
        placed.marker.getElement().toggleAttribute('data-in-card-cluster', inCardCluster)
      }
    }
    const lngLats = new Map(cards.map((card) => [card.gameId, card.lngLat]))
    this.cardClusters = layout.cardClusters.map(({ gameIds }) => ({ gameIds, lngLat: lngLats.get(gameIds[0])! }))
    this.drawLayout(cards, layout)
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
    void source.setData(cardLayoutFeatures(cards, layout, (x, y) => this.map.unproject([x, y]).toArray()))
  }

  /** The games in each card cluster on screen now. */
  cardClusterGames(): string[][] {
    return this.cardClusters.map((cardCluster) => cardCluster.gameIds)
  }

  /**
   * Plays an animation on a game's card, or over the count it's in when there's no room for its
   * card. False when the game has neither on screen.
   */
  animate(gameId: string, animation: PinAnimation): boolean {
    const cardCluster = this.cardClusters.find(({ gameIds }) => gameIds.includes(gameId))
    if (cardCluster) {
      pulse(this.map, cardCluster.lngLat, animation, 'cluster')
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

  clear(): void {
    for (const { marker } of this.placed.values()) marker.remove()
    this.cardClusters = []
    this.placed.clear()
    this.animating.clear()
  }
}

/** How far a card's pointer reaches below the card, as its CSS draws it (see .score-card). */
function cardPointer(card: HTMLElement): number {
  return parseFloat(getComputedStyle(card).getPropertyValue('--score-card-pointer')) || 0
}

const animationClass = (animation: PinAnimation) => `score-card--animate-${animation}`

function drawScoreCard(
  element: HTMLElement,
  card: ScoreCard,
  selected: boolean,
  style: CardStyle,
  animation?: PinAnimation,
): void {
  element.className = `score-card score-card--${card.status.toLowerCase()} score-card--style-${style}`
  element.classList.toggle('score-card--selected', selected)
  if (animation) element.classList.add(animationClass(animation))
  element.dataset.gameId = card.gameId
  element.replaceChildren(...cardContent(card, style))
}

/** What each card style shows, and in what order (see the styles in index.css). */
function cardContent(card: ScoreCard, style: CardStyle): HTMLElement[] {
  const clock = span('score-card__clock', card.clockLine)
  switch (style) {
    case 'hud': {
      // A header strip with a status light and the clock (or the status), then the teams.
      const header = document.createElement('div')
      header.className = 'score-card__hud-header'
      header.append(span('score-card__hud-light', ''), span('score-card__hud-clock', card.clockLine || card.status))
      return [header, team(card.away), team(card.home)]
    }
    case 'led':
      // The clock lit above, as on a stadium board.
      return [clock, team(card.away), team(card.home)]
    case 'broadcast': {
      // One strip: the clock, then a slanted block for each team.
      const block = (t: ScoreCardTeam, side: 'away' | 'home') => {
        const element = document.createElement('div')
        element.className = `score-card__broadcast-team score-card__broadcast-team--${side}`
        const parts = [logo(t), span('score-card__abbreviation', t.abbreviation), span('score-card__score', t.score)]
        element.append(...(side === 'away' ? parts : parts.reverse()))
        return element
      }
      const parts: HTMLElement[] = [block(card.away, 'away'), block(card.home, 'home')]
      if (card.clockLine) {
        const tab = document.createElement('div')
        tab.className = 'score-card__clock'
        tab.append(span('', card.clockLine))
        parts.unshift(tab)
      }
      return parts
    }
    case 'tactical': {
      // Each team with a dotted leader to its score.
      const row = (t: ScoreCardTeam) => {
        const element = document.createElement('div')
        element.className = 'score-card__team'
        element.append(
          logo(t),
          span('score-card__abbreviation', t.abbreviation),
          span('score-card__leader', ''),
          span('score-card__score', t.score || '-'),
        )
        return element
      }
      return [row(card.away), row(card.home), clock]
    }
    case 'neon': {
      // The score lit large, the teams beneath it, then the clock.
      const scored = card.away.score || card.home.score
      const teams = document.createElement('div')
      teams.className = 'score-card__neon-teams'
      teams.append(
        logo(card.away),
        span('', card.away.abbreviation),
        span('', scored ? '·' : 'vs'),
        span('', card.home.abbreviation),
        logo(card.home),
      )
      return [span('score-card__neon-score', scored ? `${card.away.score}:${card.home.score}` : '–:–'), teams, clock]
    }
  }
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
