import { LngLatBounds, Marker, type MapSourceDataEvent, type Map as MapLibreMap } from 'maplibre-gl'
import type { Feature, Point } from 'geojson'
import type { Game } from '../games/game'
import { cardPins } from './cardPins'
import { layOutCards, type CardCrowd, type ScreenCard, type ScreenOffset, type Segment } from './cardLayout'
import { cityNameBox, cityOfPlace, gameCities, type City, type ScreenBox } from './gameCities'
import { cityNameLook, gameCitiesState, gameCityPlaces, placeTiles } from './globeStyle'
import type { PinAnimation } from './pinAnimation'
import { pinSource } from './pinLayers'
import { pulse } from './pinPulse'
import { scoreCard, type ScoreCard, type ScoreCardTeam } from './scoreCard'
import { crowdStacking, selectedStacking, statusLooks } from './statusLook'
import { maxZoom, pinLayout } from './zoomLevels'

interface PlacedCard {
  marker: Marker
  /** The card last drawn into the marker, so unchanged cards aren't redrawn every frame. */
  drawn: string
  /** The card's size on screen, measured when it's drawn. */
  width: number
  height: number
  /** Where the card sits from its venue: just above it, or moved aside to make room for others (see cardLayout). */
  offset: ScreenOffset
  /** The line and venue dot drawn while the card is moved (see drawTrail). */
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
  private readonly onSelect: (gameId: string) => void
  /** Trails from moved cards to their venues, in one layer just above the map so no trail crosses over a card. */
  private readonly trails = document.createElementNS(svgNamespace, 'svg')
  /** Counts of games with no room for a card, by the first game in each. */
  private readonly crowds = new Map<string, PlacedCrowd>()
  /** The cities named for the games (see gameCities), whose names cards and trails keep clear of. */
  private cities: City[] = []
  /** True when the games or the map's loaded places have changed since the cities were found. */
  private citiesStale = true
  /** How far a card's pointer reaches below it, read from the first card drawn (see cardPointer). */
  private pointer = 0

  /** `onSelect` is called with a game's id when its card is selected. */
  constructor(map: MapLibreMap, onSelect: (gameId: string) => void) {
    this.map = map
    this.onSelect = onSelect
    this.trails.classList.add('score-card-trails')
    map.getCanvas().after(this.trails)
    map.on('sourcedata', this.onSourceData)
  }

  /** Marks the cities stale when new place tiles load, as they may hold a game's city. */
  private readonly onSourceData = (event: MapSourceDataEvent): void => {
    if (event.sourceId === placeTiles.source && event.tile) this.citiesStale = true
  }

  /** Highlights the selected game's card, if it has one. */
  setSelected(gameId: string | null): void {
    this.selectedGameId = gameId
    this.sync()
  }

  setGames(games: readonly Game[]): void {
    this.games = new Map(games.map((game) => [game.id, game]))
    this.citiesStale = true
    this.sync()
  }

  /** Places, updates and removes cards to match what the pin source shows at the current zoom. */
  sync(): void {
    if (this.citiesStale) this.findCities()
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
        drawScoreCard(cardElement, card, selected, this.animating.get(gameId))
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
      names: this.cityNames(),
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

  /**
   * Finds the place named for each game among the places loaded so far, however small, and has the
   * map always write those places' names (see globeStyle's game city names).
   */
  private findCities(): void {
    if (!this.map.getSource(placeTiles.source)) return
    this.citiesStale = false
    const places = new Map<number, City>()
    for (const feature of this.map.querySourceFeatures(placeTiles.source, {
      sourceLayer: placeTiles.sourceLayer,
      filter: gameCityPlaces,
    })) {
      const city = cityOfPlace(feature)
      if (city && !places.has(city.id)) places.set(city.id, city)
    }
    const cities = gameCities(
      [...this.games.values()].map((game) => game.venue),
      [...places.values()],
    )
    const ids = cities.map((city) => city.id).sort((a, b) => a - b)
    if (ids.join() !== this.cities.map((city) => city.id).sort((a, b) => a - b).join()) {
      this.map.setGlobalStateProperty(gameCitiesState, ids)
    }
    this.cities = cities
  }

  /** Where the names of the cities named for the games are written on screen. */
  private cityNames(): ScreenBox[] {
    const zoom = this.map.getZoom()
    return this.cities.map((city) =>
      cityNameBox(city, this.map.project([city.longitude, city.latitude]), cityNameLook(zoom, city.capital), measureText),
    )
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
          this.zoomToCrowd(key)
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

  /**
   * Zooms in until a crowd splits: to fit its games, at least a level in, and again from there while
   * some of them are still crowded (until the globe can zoom no further in). A move by the viewer
   * along the way stops it.
   */
  private zoomToCrowd(key: string): void {
    const crowd = this.crowds.get(key)
    if (!crowd) return
    const bounds = new LngLatBounds()
    for (const gameId of crowd.gameIds) {
      const lngLat = this.placed.get(gameId)?.marker.getLngLat()
      if (lngLat) bounds.extend(lngLat)
    }
    const fitted = this.map.cameraForBounds(bounds, { padding: crowdZoomPadding })?.zoom ?? 0
    const zoom = Math.min(maxZoom, Math.max(this.map.getZoom() + 1, fitted))
    const center = bounds.getCenter()
    this.map.easeTo({ center, zoom })
    this.map.once('idle', () => {
      const arrived = Math.abs(this.map.getZoom() - zoom) < 0.01 && this.map.getCenter().distanceTo(center) < 1
      if (!arrived || zoom >= maxZoom) return
      const stillCrowded = [...this.crowds].find(([, c]) => c.gameIds.some((id) => crowd.gameIds.includes(id)))
      if (stillCrowded) this.zoomToCrowd(stillCrowded[0])
    })
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
    this.map.off('sourcedata', this.onSourceData)
    for (const { marker } of this.placed.values()) marker.remove()
    for (const { marker } of this.crowds.values()) marker.remove()
    this.crowds.clear()
    this.trails.remove()
    this.placed.clear()
    this.cities = []
    this.animating.clear()
  }
}

/** How far a card's pointer reaches below the card, as its CSS draws it (see .score-card). */
function cardPointer(card: HTMLElement): number {
  return parseFloat(getComputedStyle(card).getPropertyValue('--score-card-pointer')) || 0
}

/** Room left around a crowd's games when zooming in to them. */
const crowdZoomPadding = 120

const svgNamespace = 'http://www.w3.org/2000/svg'

const measuring = document.createElement('canvas').getContext('2d')

/**
 * A line's width in a font, in pixels. The map writes Open Sans from its own glyphs, which the page
 * doesn't have; the browser's fallback sans-serif measures a little wider, which errs on the side of room.
 */
function measureText(text: string, font: string): number {
  if (!measuring) return text.length * fallbackLetterWidth * parseFloat(font.split(' ')[1])
  measuring.font = font
  return measuring.measureText(text).width
}
// A letter's width in ems, roughly, where there's no canvas to measure with.
const fallbackLetterWidth = 0.6

function newTrail(): SVGGElement {
  const trail = document.createElementNS(svgNamespace, 'g')
  trail.append(document.createElementNS(svgNamespace, 'line'), document.createElementNS(svgNamespace, 'circle'))
  return trail
}

/** Points a moved card back at its venue: a line from the card's edge to a dot on the venue. */
function drawTrail(element: SVGGElement, trail: Segment | null): void {
  element.style.display = trail ? '' : 'none'
  if (!trail) return
  const [line, dot] = element.children
  line.setAttribute('x1', String(trail.x1))
  line.setAttribute('y1', String(trail.y1))
  line.setAttribute('x2', String(trail.x2))
  line.setAttribute('y2', String(trail.y2))
  dot.setAttribute('cx', String(trail.x2))
  dot.setAttribute('cy', String(trail.y2))
}

const animationClass = (animation: PinAnimation) => `score-card--animate-${animation}`

function drawScoreCard(element: HTMLElement, card: ScoreCard, selected: boolean, animation?: PinAnimation): void {
  element.className = `score-card score-card--${card.status.toLowerCase()}`
  element.classList.toggle('score-card--selected', selected)
  if (animation) element.classList.add(animationClass(animation))
  element.dataset.gameId = card.gameId
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
