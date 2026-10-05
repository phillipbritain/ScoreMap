import { Marker, type Map as MapLibreMap } from 'maplibre-gl'
import type { Feature, Point } from 'geojson'
import type { Game, GameStatus } from '../games/game'
import { cardPins } from './cardPins'
import { pinSource, statusColors } from './pinLayers'
import { scoreCard, type ScoreCard, type ScoreCardTeam } from './scoreCard'
import { pinLayout } from './zoomLevels'

interface PlacedCard {
  marker: Marker
  /** The card last drawn into the marker, so unchanged cards aren't redrawn every frame. */
  drawn: string
}

/**
 * Zoomed in, shows each unclustered pin as an HTML score card (logos, abbreviations, score, clock line).
 * Clusters stay as map layers; zoomed out, the small-pin layer shows instead and no cards are placed.
 */
export class ScoreCardMarkers {
  private readonly placed = new Map<string, PlacedCard>()
  private games = new Map<string, Game>()
  private selectedGameId: string | null = null
  private readonly map: MapLibreMap
  private readonly onSelect: (gameId: string) => void

  /** `onSelect` is called with a game's id when its card is selected. */
  constructor(map: MapLibreMap, onSelect: (gameId: string) => void) {
    this.map = map
    this.onSelect = onSelect
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
        placed = { marker: new Marker({ element }).setLngLat(lngLat).addTo(this.map), drawn: '' }
        this.placed.set(gameId, placed)
      } else {
        placed.marker.setLngLat(lngLat)
      }
      if (placed.drawn !== drawn) {
        const element = placed.marker.getElement()
        // Live cards draw on top, as Live small pins do; the selected card above all.
        element.style.zIndex = String(selected ? 3 : stacking[card.status])
        drawScoreCard(element.firstElementChild as HTMLElement, card, selected)
        placed.drawn = drawn
      }
    }

    for (const [gameId, { marker }] of this.placed) {
      if (keep.has(gameId)) continue
      marker.remove()
      this.placed.delete(gameId)
    }
  }

  clear(): void {
    for (const { marker } of this.placed.values()) marker.remove()
    this.placed.clear()
  }
}

const stacking: Record<GameStatus, number> = { Live: 2, Upcoming: 1, Final: 0 }

function drawScoreCard(element: HTMLElement, card: ScoreCard, selected: boolean): void {
  element.className = `score-card score-card--${card.status.toLowerCase()}`
  element.classList.toggle('score-card--selected', selected)
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
