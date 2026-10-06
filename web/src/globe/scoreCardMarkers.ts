import { Marker, type Map as MapLibreMap } from 'maplibre-gl'
import type { Feature, Point } from 'geojson'
import type { Game, GameStatus } from '../games/game'
import { cardPins } from './cardPins'
import { spreadCards, type CardBox, type CardShift } from './cardSpread'
import type { PinAnimation } from './pinAnimation'
import { pinSource, statusColors } from './pinLayers'
import { scoreCard, type ScoreCard, type ScoreCardTeam } from './scoreCard'
import { pinLayout } from './zoomLevels'

interface PlacedCard {
  marker: Marker
  /** The card last drawn into the marker, so unchanged cards aren't redrawn every frame. */
  drawn: string
  /** The card's size on screen, measured when it's drawn. */
  width: number
  height: number
  /** How far the card is moved from above its venue to make room for others (see cardSpread). */
  shift: CardShift
  /** The line and venue dot drawn while the card is moved (see drawTrail). */
  trail: SVGGElement
}

/**
 * Zoomed in, shows each unclustered pin as an HTML score card (logos, abbreviations, score, clock line).
 * Clusters stay as map layers; zoomed out, the small-pin layer shows instead and no cards are placed.
 */
export class ScoreCardMarkers {
  private readonly placed = new Map<string, PlacedCard>()
  private games = new Map<string, Game>()
  private selectedGameId: string | null = null
  /** Cards mid-animation, so redrawing a card (say, with its new score) doesn't cut the animation short. */
  private readonly animating = new Map<string, PinAnimation>()
  private readonly map: MapLibreMap
  private readonly onSelect: (gameId: string) => void
  /** Trails from moved cards to their venues, in one layer just above the map so no trail crosses over a card. */
  private readonly trails = document.createElementNS(svgNamespace, 'svg')

  /** `onSelect` is called with a game's id when its card is selected. */
  constructor(map: MapLibreMap, onSelect: (gameId: string) => void) {
    this.map = map
    this.onSelect = onSelect
    this.trails.classList.add('score-card-trails')
    map.getCanvas().after(this.trails)
  }

  /** Highlights the selected game's card, if it has one. */
  setSelected(gameId: string | null): void {
    this.selectedGameId = gameId
    this.sync()
  }

  setGames(games: readonly Game[]): void {
    this.games = new Map(games.map((game) => [game.id, game]))
    this.sync()
  }

  /** Places, updates and removes cards to match what the pin source shows at the current zoom. */
  sync(): void {
    if (!this.map.getSource(pinSource) || !this.map.isSourceLoaded(pinSource)) return
    const wanted =
      pinLayout(this.map.getZoom()).size === 'card'
        ? cardPins(this.map.querySourceFeatures(pinSource) as Feature<Point>[])
        : []

    const keep = new Set<string>()
    for (const { gameId, lngLat } of wanted) {
      const game = this.games.get(gameId)
      if (!game) continue
      keep.add(gameId)
      const card = scoreCard(game)
      const selected = gameId === this.selectedGameId
      const drawn = JSON.stringify({ card, selected })
      let placed = this.placed.get(gameId)
      if (!placed) {
        // MapLibre owns the marker element's classes and transform, so the card goes inside it.
        const element = document.createElement('div')
        element.append(document.createElement('div'))
        element.addEventListener('click', (event) => {
          event.stopPropagation()
          this.onSelect(gameId)
        })
        // Above the venue, its pointer's tip on the spot; the city's name sits below its dot.
        const marker = new Marker({ element, anchor: 'bottom', offset: [0, -cardPointerPx] })
        placed = {
          marker: marker.setLngLat(lngLat).addTo(this.map),
          drawn: '',
          width: 0,
          height: 0,
          shift: { dx: 0, dy: 0 },
          trail: this.trails.appendChild(newTrail()),
        }
        this.placed.set(gameId, placed)
      } else {
        placed.marker.setLngLat(lngLat)
      }
      if (placed.drawn !== drawn) {
        const element = placed.marker.getElement()
        // Live cards draw on top, as Live small pins do; the selected card above all.
        element.style.zIndex = String(selected ? 3 : stacking[card.status])
        const cardElement = element.firstElementChild as HTMLElement
        drawScoreCard(cardElement, card, selected, this.animating.get(gameId))
        placed.trail.style.setProperty('--status-color', statusColors[card.status])
        placed.drawn = drawn
        placed.width = cardElement.offsetWidth
        placed.height = cardElement.offsetHeight
      }
    }

    this.spread(keep)

    for (const [gameId, { marker, trail }] of this.placed) {
      if (keep.has(gameId)) continue
      marker.remove()
      trail.remove()
      this.placed.delete(gameId)
      this.animating.delete(gameId)
    }
  }

  /** Moves cards that would overlap apart, each with a trail back to its venue. */
  private spread(gameIds: ReadonlySet<string>): void {
    const boxes = new Map<string, CardBox>()
    for (const gameId of gameIds) {
      const { marker, width, height } = this.placed.get(gameId)!
      const venue = this.map.project(marker.getLngLat())
      boxes.set(gameId, {
        gameId,
        x: venue.x,
        y: venue.y - cardPointerPx - height / 2,
        width,
        height,
        venueX: venue.x,
        venueY: venue.y,
      })
    }
    for (const [gameId, shift] of spreadCards([...boxes.values()])) {
      const placed = this.placed.get(gameId)!
      if (shift.dx !== placed.shift.dx || shift.dy !== placed.shift.dy) {
        placed.shift = shift
        placed.marker.setOffset([shift.dx, shift.dy - cardPointerPx])
        placed.marker.getElement().toggleAttribute('data-moved', shift.dx !== 0 || shift.dy !== 0)
      }
      // Redrawn every frame: the venue moves on screen as the globe turns.
      drawTrail(placed.trail, boxes.get(gameId)!, shift)
    }
  }

  /** Plays an animation on a game's card. False when the game has no card on screen. */
  animate(gameId: string, animation: PinAnimation): boolean {
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
    this.trails.remove()
    this.placed.clear()
    this.animating.clear()
  }
}

/** How far a card's pointer reaches below the card (see .score-card::after). */
const cardPointerPx = 6

const stacking: Record<GameStatus, number> = { Live: 2, Upcoming: 1, Final: 0, Disrupted: 0 }

const svgNamespace = 'http://www.w3.org/2000/svg'

function newTrail(): SVGGElement {
  const trail = document.createElementNS(svgNamespace, 'g')
  trail.append(document.createElementNS(svgNamespace, 'line'), document.createElementNS(svgNamespace, 'circle'))
  return trail
}

/**
 * Points a moved card back at its venue, in place of the card's own short pointer: a line from the
 * card's edge to a dot on the venue. A card in its usual spot has none.
 */
function drawTrail(trail: SVGGElement, home: CardBox, { dx, dy }: CardShift): void {
  const moved = dx !== 0 || dy !== 0
  trail.style.display = moved ? '' : 'none'
  if (!moved) return
  const { venueX, venueY } = home
  const centreX = home.x + dx
  const centreY = home.y + dy
  // Where a line from the card's centre to the venue leaves the card.
  const toVenueX = venueX - centreX
  const toVenueY = venueY - centreY
  const leaves = Math.min(1, (home.width / 2) / Math.abs(toVenueX), (home.height / 2) / Math.abs(toVenueY))
  const [line, dot] = trail.children
  line.setAttribute('x1', String(centreX + toVenueX * leaves))
  line.setAttribute('y1', String(centreY + toVenueY * leaves))
  line.setAttribute('x2', String(venueX))
  line.setAttribute('y2', String(venueY))
  dot.setAttribute('cx', String(venueX))
  dot.setAttribute('cy', String(venueY))
}

const animationClass = (animation: PinAnimation) => `score-card--animate-${animation}`

function drawScoreCard(element: HTMLElement, card: ScoreCard, selected: boolean, animation?: PinAnimation): void {
  element.className = `score-card score-card--${card.status.toLowerCase()}`
  element.classList.toggle('score-card--selected', selected)
  if (animation) element.classList.add(animationClass(animation))
  element.dataset.gameId = card.gameId
  element.style.setProperty('--status-color', statusColors[card.status])
  const clock = span('score-card__clock', card.clockLine)
  element.replaceChildren(team(card.away), team(card.home), clock)
}

function team({ abbreviation, logoUrl, score }: ScoreCardTeam): HTMLElement {
  const row = document.createElement('div')
  row.className = 'score-card__team'
  const logo = document.createElement('img')
  logo.className = 'score-card__logo'
  logo.alt = ''
  if (logoUrl) logo.src = logoUrl
  else logo.style.visibility = 'hidden'
  row.append(logo, span('score-card__abbreviation', abbreviation), span('score-card__score', score))
  return row
}

function span(className: string, text: string): HTMLElement {
  const element = document.createElement('span')
  element.className = className
  element.textContent = text
  return element
}
