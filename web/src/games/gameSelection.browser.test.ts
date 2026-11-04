import { createElement, act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, expect, it, vi } from 'vitest'
import type { Map as MapLibreMap } from 'maplibre-gl'
import { GlobeMap } from '../globe/globeMap'
import { pinClusterLayer } from '../globe/pinLayers'
import { userEvent } from 'vitest/browser'
import type { Game } from './game'
import { GameNavigation } from './GameNavigation'
import { useGameSelection } from './useGameSelection'
import { GamePanel } from '../panel/GamePanel'
import { applyTheme } from '../theme/applyTheme'
import { builtInTheme } from '../theme/builtInTheme'
import '../index.css'

applyTheme(document.documentElement, builtInTheme)

function game(id: string): Game {
  const longitude = 0, latitude = 0, status = 'Live', home = '0', away = '0', clock = null
  return {
    id,
    league: 'NFL',
    sport: 'Football',
    startTime: '2026-10-04T17:00:00+00:00',
    status,
    delayed: false,
    disruption: null,
    endTime: null,
    contest: {
      kind: 'sides',
      home: { abbreviation: 'KC', fullName: 'Kansas City Chiefs', logoUrl: null, score: home, rank: null, record: null },
      away: { abbreviation: 'BUF', fullName: 'Buffalo Bills', logoUrl: null, score: away, rank: null, record: null },
    },
    clock,
    period: null,
    clutchTime: false,
    hot: false,
    venue: { name: null, city: null, region: null, country: null, latitude, longitude, timeZone: null, photo: null, court: null },
    broadcasters: [],
    streamLinks: [],
    note: null,
    attendance: null,
    odds: null,
    situation: null,
    lastScore: null,
    keyEvents: [],
    topEvent: false,
    scoreline: null,
  }
}

let root: Root
let container: HTMLElement
function Selection({ games }: { games: Game[] }) {
  const { selectedGame, panel, selectGame, closeGame } = useGameSelection(games)
  return createElement('div', null,
    createElement(GameNavigation, { games, onSelect: selectGame, inert: false }),
    selectedGame && createElement(GamePanel, { ref: panel, game: selectedGame,
      colour: '#d4ac63', textOnColour: '#000e28', onClose: closeGame }),
  )
}
async function show(games: Game[]) {
  if (!container) {
    container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)
  }
  await act(async () => root.render(createElement(Selection, { games })))
}
const summary = () => container.querySelector<HTMLElement>('summary')!
const choice = (id: string) => container.querySelector<HTMLButtonElement>(`[data-game-id="${id}"]`)!
const close = () => container.querySelector<HTMLButtonElement>('.game-panel__close')!

afterEach(async () => {
  await act(async () => root?.unmount())
  container?.remove()
  container = null!
})

it('opens the current game with Enter and Space and restores focus on close', async () => {
  await show([game('A'), game('B')])
  summary().focus()
  await userEvent.keyboard('{Enter}{Tab}')
  expect(document.activeElement).toBe(choice('A'))
  await userEvent.keyboard('{Enter}')
  expect(document.activeElement).toBe(close())
  expect(container.querySelector('.game-panel')).not.toBeNull()
  await userEvent.keyboard('{Escape}')
  expect(document.activeElement).toBe(choice('A'))
  await userEvent.keyboard('{Tab}')
  const updated = game('B')
  if (updated.contest.kind === 'sides') updated.contest.home.fullName = 'Updated Chiefs'
  await show([game('A'), updated])
  expect(choice('B').textContent).toContain('Updated Chiefs')
  await userEvent.keyboard(' ')
  expect(document.activeElement).toBe(close())
  expect(container.querySelector('.game-panel')!.textContent).toContain('Updated Chiefs')
  if (updated.contest.kind === 'sides') updated.contest.home.score = '21'
  await show([game('A'), { ...updated }])
  expect(container.querySelector('.game-panel')!.textContent).toContain('21')
  expect(document.activeElement).toBe(close())
  await userEvent.keyboard('{Enter}')
  expect(document.activeElement).toBe(choice('B'))
})

it('recovers focus when filtering/removal detaches a list control or its open panel', async () => {
  await show([game('A'), game('B')])
  summary().focus()
  await userEvent.keyboard('{Enter}{Tab}')
  expect(document.activeElement).toBe(choice('A'))
  await show([game('B')])
  expect(document.activeElement).toBe(summary())
  await userEvent.keyboard('{Tab}{Enter}')
  expect(document.activeElement).toBe(close())
  await show([])
  expect(container.querySelector('.game-panel')).toBeNull()
  expect(document.activeElement).toBe(summary())
  await show([game('B')])
  expect(container.querySelector('.game-panel')).toBeNull()
})

it('keeps filter focus when a filter hides the selected game', async () => {
  await show([game('A')])
  summary().focus()
  await userEvent.keyboard('{Enter}{Tab}{Enter}')
  const filter = document.createElement('button')
  filter.textContent = 'Live games only'
  document.body.append(filter)
  filter.focus()
  await show([])
  expect(document.activeElement).toBe(filter)
  filter.remove()
})

it('selects a game from the list while its pin belongs to a cluster', async () => {
  const games = [game('A'), game('B')]
  if (games[1].contest.kind === 'sides') games[1].contest.home.fullName = 'Second game Chiefs'
  const mapContainer = document.createElement('div')
  mapContainer.style.cssText = 'position:relative;width:800px;height:600px'
  document.body.append(mapContainer)
  const globe = new GlobeMap(mapContainer, {
    style: { version: 8, sources: {}, layers: [{ id: 'background', type: 'background', paint: { 'background-color': '#0b1526' } }] },
    theme: builtInTheme, startCamera: { longitude: 0, latitude: 0, zoom: 2 }, onSelect: () => {}, onCameraMove: () => {}, onStage: () => {},
  })
  try {
    globe.show(games)
    const map = (globe as unknown as { map: MapLibreMap }).map
    await vi.waitFor(() => {
      expect(map.getLayer(pinClusterLayer)).toBeDefined()
      expect(map.queryRenderedFeatures([[390, 290], [410, 310]], { layers: [pinClusterLayer] }).length).toBeGreaterThan(0)
    })
    await show(games)
    summary().focus()
    await userEvent.keyboard('{Enter}{Tab}{Tab}{Enter}')
    expect(document.activeElement).toBe(close())
    expect(container.querySelector('.game-panel')!.textContent).toContain('Second game Chiefs')
  } finally {
    globe.destroy()
    mapContainer.remove()
  }
})
