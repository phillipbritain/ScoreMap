import { LngLatBounds, Marker, type Map as MapLibreMap } from 'maplibre-gl'
import type { Feature, Point } from 'geojson'
import type { Game, GameStatus } from '../games/game'
import { cardPins } from './cardPins'
import { layOutCards, type CardBox, type CardCrowd, type CardShift } from './cardLayout'
import { cityNameBox, gameCities, type City, type ScreenBox } from './gameCities'
import { cityNameLook, gameCitiesState, namedCity, placeTiles } from './globeStyle'
import type { PinAnimation } from './pinAnimation'
import { pinSource, statusColors } from './pinLayers'
import { pulse } from './pinPulse'
import { scoreCard, type ScoreCard, type ScoreCardTeam } from './scoreCard'
import { maxZoom, pinLayout } from './zoomLevels'

interface PlacedCard {
  marker: Marker
  /** The card last drawn into the marker, so unchanged cards aren't redrawn every frame. */
  drawn: string
  /** The card's size on screen, measured when it's drawn. */
  width: number
  height: number
  /** How far the card is moved from above its venue to make room for others (see cardLayout). */
  shift: CardShift
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

  /** `onSelect` is called with a game's id when its card is selected. */
  constructor(map: MapLibreMap, onSelect: (gameId: string) => void) {
    this.map = map
    this.onSelect = onSelect
    this.trails.classList.add('score-card-trails')
    map.getCanvas().after(this.trails)
    map.on('sourcedata', (event) => {
      if (event.sourceId === placeTiles.source && event.tile) this.citiesStale = true
    })
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
        // Above the venue, its pointer's tip on the spot; the city's name sits below its dot.
        const marker = new Marker({ element, anchor: 'bottom', offset: [0, -cardPointerPx] })
        placed = {
          marker: marker.setLngLat(lngLat).addTo(this.map),
          drawn: '',
          width: 0,
          height: 0,
          shift: { dx: 0, dy: 0 },
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
        element.style.zIndex = String(selected ? 3 : stacking[card.status])
        const cardElement = element.firstElementChild as HTMLElement
        drawScoreCard(cardElement, card, selected, this.animating.get(gameId))
        placed.trail.style.setProperty('--status-color', statusColors[card.status])
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
   * there's no room for. Only cards on screen (or nearly) are laid out; the rest stay where they'd sit.
   */
  private layOut(gameIds: ReadonlySet<string>): void {
    const canvas = this.map.getCanvas()
    const boxes = new Map<string, CardBox>()
    for (const gameId of gameIds) {
      const { marker, width, height } = this.placed.get(gameId)!
      const venue = this.map.project(marker.getLngLat())
      const nearScreen =
        venue.x > -offScreenMargin &&
        venue.x < canvas.clientWidth + offScreenMargin &&
        venue.y > -offScreenMargin &&
        venue.y < canvas.clientHeight + offScreenMargin
      if (!nearScreen) continue
      boxes.set(gameId, {
        gameId,
        x: venue.x,
        y: venue.y - cardPointerPx - height / 2,
        width,
        height,
        venueX: venue.x,
        venueY: venue.y,
        rank: this.rank(gameId),
      })
    }
    const { shifts, crowds } = layOutCards([...boxes.values()], this.cityNames())

    for (const [gameId, placed] of this.placed) {
      const shift = shifts.get(gameId) ?? { dx: 0, dy: 0 }
      const box = boxes.get(gameId)
      const crowded = box !== undefined && !shifts.has(gameId)
      if (shift.dx !== placed.shift.dx || shift.dy !== placed.shift.dy) {
        placed.shift = shift
        placed.marker.setOffset([shift.dx, shift.dy - cardPointerPx])
        placed.marker.getElement().toggleAttribute('data-moved', shift.dx !== 0 || shift.dy !== 0)
      }
      if (crowded !== placed.crowded) {
        placed.crowded = crowded
        // Hidden rather than removed, so the card keeps its size for laying out the next frame.
        placed.marker.getElement().toggleAttribute('data-crowded', crowded)
      }
      // Redrawn every frame: the venue moves on screen as the globe turns.
      drawTrail(placed.trail, box && !crowded ? box : null, shift)
    }
    this.drawCrowds(crowds)
  }

  /**
   * Finds the city named for each game among the places loaded so far, and has the map always write
   * those cities' names (see globeStyle's game city names).
   */
  private findCities(): void {
    if (!this.map.getSource(placeTiles.source)) return
    this.citiesStale = false
    const places = new Map<number, City>()
    for (const { id, properties: p, geometry } of this.map.querySourceFeatures(placeTiles.source, {
      sourceLayer: placeTiles.sourceLayer,
      filter: namedCity,
    })) {
      if (typeof id !== 'number' || places.has(id) || geometry.type !== 'Point') continue
      const [longitude, latitude] = geometry.coordinates
      places.set(id, { id, name: placeName(p), capital: p.capital === 2, longitude, latitude })
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

  /** Where the names of the cities named for the games are written on screen, for those on screen (or nearly). */
  private cityNames(): ScreenBox[] {
    const canvas = this.map.getCanvas()
    const zoom = this.map.getZoom()
    return this.cities.flatMap((city) => {
      const dot = this.map.project([city.longitude, city.latitude])
      const nearScreen =
        dot.x > -offScreenMargin &&
        dot.x < canvas.clientWidth + offScreenMargin &&
        dot.y > -offScreenMargin &&
        dot.y < canvas.clientHeight + offScreenMargin
      return nearScreen ? [cityNameBox(city, dot, cityNameLook(zoom, city.capital), measureText)] : []
    })
  }

  /** Which cards get room first: the selected game's, then Live, then Upcoming, then the rest. */
  private rank(gameId: string): number {
    if (gameId === this.selectedGameId) return 0
    return crowdRank[this.games.get(gameId)?.status ?? 'Final']
  }

  private drawCrowds(crowds: readonly CardCrowd[]): void {
    const keep = new Set<string>()
    for (const { gameIds } of crowds) {
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
        // Above every card, so a count is never hidden.
        element.style.zIndex = '4'
        crowd = { marker: new Marker({ element }).setLngLat(at).addTo(this.map), gameIds, drawn: '' }
        this.crowds.set(key, crowd)
      } else {
        crowd.marker.setLngLat(at)
        crowd.gameIds = gameIds
      }
      const status = crowdStatus(gameIds.map((id) => this.games.get(id)?.status ?? 'Final'))
      const drawn = `${status} ${gameIds.length}`
      if (crowd.drawn !== drawn) {
        const count = crowd.marker.getElement().firstElementChild as HTMLElement
        count.className = `score-crowd score-crowd--${status.toLowerCase()}`
        count.style.setProperty('--status-color', statusColors[status])
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

  /** Zooms in to fit a crowd's games, where there's room for each to have its card. */
  private zoomToCrowd(key: string): void {
    const crowd = this.crowds.get(key)
    if (!crowd) return
    const bounds = new LngLatBounds()
    for (const gameId of crowd.gameIds) {
      const lngLat = this.placed.get(gameId)?.marker.getLngLat()
      if (lngLat) bounds.extend(lngLat)
    }
    // At least a level in, so a crowd at a single spot still opens up, and at most a couple: past
    // that, cards have room to spread and a crowd of games close together would leave the screen empty.
    const fitted = this.map.cameraForBounds(bounds, { padding: crowdZoomPadding })?.zoom ?? 0
    const zoom = Math.min(maxZoom, this.map.getZoom() + 2, Math.max(this.map.getZoom() + 1, fitted))
    this.map.easeTo({ center: bounds.getCenter(), zoom })
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
    this.cities = []
    this.animating.clear()
  }
}

/** How far a card's pointer reaches below the card (see .score-card::after). */
const cardPointerPx = 6

const stacking: Record<GameStatus, number> = { Live: 2, Upcoming: 1, Final: 0, Disrupted: 0 }

const crowdRank: Record<GameStatus, number> = { Live: 1, Upcoming: 2, Final: 3, Disrupted: 3 }

/** Cards whose venues are this far off screen aren't laid out: nothing on screen can get in their way. */
const offScreenMargin = 200

/** Room left around a crowd's games when zooming in to them. */
const crowdZoomPadding = 120

/**
 * A crowd takes the most prominent status among its games, as a cluster does: Live if any is Live,
 * then Upcoming, then Final, and Disrupted only when all its games are.
 */
function crowdStatus(statuses: readonly GameStatus[]): GameStatus {
  for (const status of ['Live', 'Upcoming', 'Final'] as const) if (statuses.includes(status)) return status
  return 'Disrupted'
}

const svgNamespace = 'http://www.w3.org/2000/svg'

/** A place's name as the map writes it: in Latin letters, with its own script on a second line when it has one. */
function placeName(properties: Record<string, unknown>): string {
  const text = (key: string) => (typeof properties[key] === 'string' ? (properties[key] as string) : undefined)
  const nonLatin = text('name:nonlatin')
  if (nonLatin) return `${text('name:latin') ?? ''}
${nonLatin}`
  return text('name_en') ?? text('name') ?? ''
}

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

/**
 * Points a moved card back at its venue, in place of the card's own short pointer: a line from the
 * card's edge to a dot on the venue. A card in its usual spot has none.
 */
function drawTrail(trail: SVGGElement, home: CardBox | null, { dx, dy }: CardShift): void {
  const moved = home !== null && (dx !== 0 || dy !== 0)
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
