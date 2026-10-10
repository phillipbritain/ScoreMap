import { Marker, type Map as MapLibreMap } from 'maplibre-gl'
import type { Feature, Point } from 'geojson'
import type { Game } from '../games/game'
import { cardPins, type CardPin } from './cardPins'
import { defaultCardStyle, type CardStyle } from './cardStyle'
import { layOutCards, type CardCrowd, type ScreenCard, type ScreenOffset, type Segment } from './cardLayout'
import type { PinAnimation } from './pinAnimation'
import { pinSource } from './pinLayers'
import type { PlaceNames } from './placeNames'
import { pulse } from './pinPulse'
import { isBehindGlobe } from './horizon'
import { scoreCard, type ScoreCard, type ScoreCardTeam } from './scoreCard'
import { crowdStacking, selectedStacking, statusLooks } from './statusLook'
import { pinLayout } from './zoomLevels'

interface PlacedCard {
  marker: Marker
  /** The card last drawn into the marker, so unchanged cards aren't redrawn every frame. */
  drawn: string
  /** The card's size on screen, measured when it's drawn. */
  width: number
  height: number
  /** Where the card sits from its venue: just above it, or moved aside to make room for others (see cardLayout). */
  offset: ScreenOffset
  /** The line and venue point drawn while the card is moved (see drawTrail). */
  trail: SVGGElement
  /** True while there's no room for the card and its game is counted in a crowd instead. */
  crowded: boolean
}

interface PlacedCrowd {
  marker: Marker
  gameIds: string[]
  /** The count last drawn, so unchanged crowds aren't redrawn every frame. */
  drawn: string
}

/**
 * Zoomed in, shows each pin as an HTML score card (logos, abbreviations, score, clock line). Cards
 * that would overlap are moved apart with a trail back to their venue; where there's no room for
 * them all, the rest are shown as a count, like a cluster. Zoomed out, the small-pin and cluster
 * layers show instead and no cards are placed.
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
  private readonly onSelectCrowd: (gameIds: readonly string[]) => void
  /** Trails from moved cards to their venues, in one layer just above the map so no trail crosses over a card. */
  private readonly trails = document.createElementNS(svgNamespace, 'svg')
  /** Counts of games with no room for a card, by the first game in each. */
  private readonly crowds = new Map<string, PlacedCrowd>()
  /** How far a card's pointer reaches below it, read from the first card drawn (see cardPointer). */
  private pointer = 0
  private style: CardStyle = defaultCardStyle

  /**
   * `placeNames` gives the names cards and trails keep clear of; `onSelect` is called with a game's
   * id when its card is selected, and `onSelectCrowd` with a crowd's games when it is.
   */
  constructor(
    map: MapLibreMap,
    placeNames: PlaceNames,
    onSelect: (gameId: string) => void,
    onSelectCrowd: (gameIds: readonly string[]) => void,
  ) {
    this.map = map
    this.placeNames = placeNames
    this.onSelect = onSelect
    this.onSelectCrowd = onSelectCrowd
    this.trails.classList.add('score-card-trails')
    map.getCanvas().after(this.trails)
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
          offset: { dx: 0, dy: 0 },
          trail: this.trails.appendChild(newTrail()),
          crowded: false,
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
        placed.trail.setAttribute('class', `score-card-trail--${card.status.toLowerCase()}`)
        placed.drawn = drawn
        placed.width = cardElement.offsetWidth
        placed.height = cardElement.offsetHeight
      }
    }

    this.layOut(keep)

    for (const [gameId, { marker, trail }] of this.placed) {
      if (keep.has(gameId)) continue
      marker.remove()
      trail.remove()
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
    const cards = [...gameIds].map((gameId): ScreenCard => {
      const { marker, width, height } = this.placed.get(gameId)!
      const venue = this.map.project(marker.getLngLat())
      return { gameId, status: this.games.get(gameId)!.status, venueX: venue.x, venueY: venue.y, width, height }
    })
    const canvas = this.map.getCanvas()
    const layout = layOutCards(cards, {
      width: canvas.clientWidth,
      height: canvas.clientHeight,
      pointer: this.pointer,
      names: this.placeNames.nameBoxes(),
      selectedGameId: this.selectedGameId,
    })

    for (const [gameId, placed] of this.placed) {
      const placement = layout.cards.get(gameId)
      if (!placement) continue
      const { offset, crowded, trail } = placement
      if (offset.dx !== placed.offset.dx || offset.dy !== placed.offset.dy) {
        placed.offset = offset
        placed.marker.setOffset([offset.dx, offset.dy])
        placed.marker.getElement().toggleAttribute('data-moved', trail !== null)
      }
      if (crowded !== placed.crowded) {
        placed.crowded = crowded
        // Hidden rather than removed, so the card keeps its size for laying out the next frame.
        placed.marker.getElement().toggleAttribute('data-crowded', crowded)
      }
      // Redrawn every frame: the venue moves on screen as the globe turns.
      drawTrail(placed.trail, trail)
    }
    this.drawCrowds(layout.crowds)
  }

  private drawCrowds(crowds: readonly CardCrowd[]): void {
    const keep = new Set<string>()
    for (const { gameIds, status } of crowds) {
      const key = gameIds[0]
      keep.add(key)
      const at = this.placed.get(key)!.marker.getLngLat()
      let crowd = this.crowds.get(key)
      if (!crowd) {
        const element = document.createElement('div')
        element.append(document.createElement('div'))
        element.addEventListener('click', (event) => {
          event.stopPropagation()
          const selected = this.crowds.get(key)
          if (selected) this.onSelectCrowd(selected.gameIds)
        })
        element.style.zIndex = String(crowdStacking)
        crowd = { marker: new Marker({ element }).setLngLat(at).addTo(this.map), gameIds, drawn: '' }
        this.crowds.set(key, crowd)
      } else {
        crowd.marker.setLngLat(at)
        crowd.gameIds = gameIds
      }
      const drawn = `${status} ${gameIds.length}`
      if (crowd.drawn !== drawn) {
        const count = crowd.marker.getElement().firstElementChild as HTMLElement
        count.className = `score-crowd score-crowd--${status.toLowerCase()}`
        count.textContent = String(gameIds.length)
        crowd.drawn = drawn
      }
    }
    for (const [key, { marker }] of this.crowds) {
      if (keep.has(key)) continue
      marker.remove()
      this.crowds.delete(key)
    }
  }

  /** The games in each crowd on screen now. */
  crowdedGames(): string[][] {
    return [...this.crowds.values()].map((crowd) => crowd.gameIds)
  }

  /**
   * Plays an animation on a game's card, or over the count it's in when there's no room for its
   * card. False when the game has neither on screen.
   */
  animate(gameId: string, animation: PinAnimation): boolean {
    for (const { marker, gameIds } of this.crowds.values()) {
      if (!gameIds.includes(gameId)) continue
      const { lng, lat } = marker.getLngLat()
      pulse(this.map, [lng, lat], animation, 'cluster')
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
    for (const { marker } of this.crowds.values()) marker.remove()
    this.crowds.clear()
    this.trails.remove()
    this.placed.clear()
    this.animating.clear()
  }
}

/** How far a card's pointer reaches below the card, as its CSS draws it (see .score-card). */
function cardPointer(card: HTMLElement): number {
  return parseFloat(getComputedStyle(card).getPropertyValue('--score-card-pointer')) || 0
}

const svgNamespace = 'http://www.w3.org/2000/svg'

function newTrail(): SVGGElement {
  const trail = document.createElementNS(svgNamespace, 'g')
  const point = document.createElementNS(svgNamespace, 'circle')
  point.classList.add('score-card-trail__point')
  const ring = document.createElementNS(svgNamespace, 'circle')
  ring.classList.add('score-card-trail__ring')
  trail.append(document.createElementNS(svgNamespace, 'line'), point, ring)
  return trail
}

/** Points a moved card back at its venue: a line from the card's edge to a ringed point on the venue. */
function drawTrail(element: SVGGElement, trail: Segment | null): void {
  element.style.display = trail ? '' : 'none'
  if (!trail) return
  const [line, point, ring] = element.children
  line.setAttribute('x1', String(trail.x1))
  line.setAttribute('y1', String(trail.y1))
  line.setAttribute('x2', String(trail.x2))
  line.setAttribute('y2', String(trail.y2))
  for (const circle of [point, ring]) {
    circle.setAttribute('cx', String(trail.x2))
    circle.setAttribute('cy', String(trail.y2))
  }
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
