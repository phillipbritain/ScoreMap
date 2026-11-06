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
/** The Games popover open, as the rail shows it, beside a stand-in for the rail's Games button. */
function Selection({ games }: { games: Game[] }) {
  const { selectedGame, panel, selectGame, closeGame } = useGameSelection(games)
  return createElement('div', null,
    createElement('button', { type: 'button', 'data-game-navigation': true }, 'Games'),
    createElement(GameNavigation, { games, onSelect: selectGame }),
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
const search = () => container.querySelector<HTMLInputElement>('input[type="search"]')!
const choice = (id: string) => container.querySelector<HTMLButtonElement>(`[data-game-id="${id}"]`)!
const close = () => container.querySelector<HTMLButtonElement>('.game-panel__close')!

afterEach(async () => {
  await act(async () => root?.unmount())
  container?.remove()
  container = null!
})

it('opens the current game with Enter and Space and restores focus on close', async () => {
  await show([game('A'), game('B')])
  expect(document.activeElement).toBe(search())
  await userEvent.keyboard('{ArrowDown}')
  expect(document.activeElement).toBe(choice('A'))
  await userEvent.keyboard('{Enter}')
  expect(document.activeElement).toBe(close())
  expect(container.querySelector('.game-panel')).not.toBeNull()
  await userEvent.keyboard('{Escape}')
  expect(document.activeElement).toBe(choice('A'))
  await userEvent.keyboard('{ArrowDown}')
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
  await userEvent.keyboard('{ArrowDown}')
  expect(document.activeElement).toBe(choice('A'))
  await show([game('B')])
  expect(document.activeElement).toBe(search())
  await userEvent.keyboard('{ArrowDown}{Enter}')
  expect(document.activeElement).toBe(close())
  await show([])
  expect(container.querySelector('.game-panel')).toBeNull()
  // The list is still open, so back to its search.
  expect(document.activeElement).toBe(search())
  await show([game('B')])
  expect(container.querySelector('.game-panel')).toBeNull()
})

it('puts the cursor in the search on opening and narrows the list as the viewer types', async () => {
  const bills = game('A')
  const lions = game('B')
  if (lions.contest.kind === 'sides') lions.contest.away.fullName = 'Detroit Lions'
  await show([bills, lions])
  expect(document.activeElement).toBe(search())

  await userEvent.keyboard('lions')
  expect(choice('A')).toBeNull()
  expect(choice('B')).not.toBeNull()

  await userEvent.keyboard(' raiders')
  expect(container.querySelector('ul')!.textContent).toBe('No games match your search.')
})

it('moves through the games with the arrow keys, across leagues, and Tab leaves the list', async () => {
  const other = { ...game('C'), league: 'NBA' }
  await show([game('A'), game('B'), other])
  const after = document.createElement('button')
  after.textContent = 'After the list'
  document.body.append(after)
  try {
    await userEvent.keyboard('{ArrowDown}{ArrowDown}{ArrowDown}')
    expect(document.activeElement).toBe(choice('C'))
    await userEvent.keyboard('{ArrowDown}')
    expect(document.activeElement).toBe(choice('C'))
    await userEvent.keyboard('{ArrowUp}{ArrowUp}{ArrowUp}')
    expect(document.activeElement).toBe(search())
    await userEvent.keyboard('{ArrowUp}')
    expect(document.activeElement).toBe(search())
    await userEvent.keyboard('{ArrowDown}{End}')
    expect(document.activeElement).toBe(choice('C'))
    await userEvent.keyboard('{Home}')
    expect(document.activeElement).toBe(search())

    await userEvent.keyboard('{Tab}')
    expect(container.contains(document.activeElement)).toBe(false)
  } finally {
    after.remove()
  }
})

it('keeps filter focus when a filter hides the selected game', async () => {
  await show([game('A')])
  await userEvent.keyboard('{ArrowDown}{Enter}')
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
    await userEvent.keyboard('{ArrowDown}{ArrowDown}{Enter}')
    expect(document.activeElement).toBe(close())
    expect(container.querySelector('.game-panel')!.textContent).toContain('Second game Chiefs')
  } finally {
    globe.destroy()
    mapContainer.remove()
  }
})

const panelText = () => container.querySelector('[aria-label="Game panel"]')?.textContent ?? ''

async function open(id: string) {
  await act(async () => choice(id).click())
}

it("names a tennis match's home player first in its panel, as its score card does", async () => {
  const match: Game = {
    ...game('T'),
    league: 'ATP',
    sport: 'Tennis',
    contest: {
      kind: 'sides',
      home: { abbreviation: 'SIN', fullName: 'Jannik Sinner', logoUrl: null, score: '1', rank: null, record: null },
      away: { abbreviation: 'ALC', fullName: 'Carlos Alcaraz', logoUrl: null, score: '0', rank: null, record: null },
    },
  }
  await show([match])
  await open('T')

  expect(panelText()).toContain('Jannik Sinner')
  expect(panelText().indexOf('Jannik Sinner')).toBeLessThan(panelText().indexOf('Carlos Alcaraz'))
})

it("shows a field's whole leaderboard with Show all, and the next game selected its top 10 again", async () => {
  // The 1st to 12th entrants as "Driver A" to "Driver L", so no name is part of another.
  const letters = 'ABCDEFGHIJKL'
  const race = (id: string, driver: string): Game => ({
    ...game(id),
    league: 'F1',
    sport: 'Racing',
    note: `${driver} Grand Prix`,
    contest: {
      kind: 'field',
      entries: Array.from({ length: 12 }, (_, i) => ({ position: i + 1, name: `${driver} ${letters[i]}`, shortName: `${driver} ${letters[i]}`, flagUrl: null, score: null })),
    },
  })
  await show([race('R1', 'Driver'), race('R2', 'Rider')])
  await open('R1')
  expect(panelText()).toContain('Driver J')
  expect(panelText()).not.toContain('Driver L')

  const showAll = [...container.querySelectorAll('button')].find((button) => button.textContent === 'Show all 12')!
  await act(async () => showAll.click())
  expect(panelText()).toContain('Driver L')

  await open('R2')
  expect(panelText()).toContain('Rider J')
  expect(panelText()).not.toContain('Rider L')
})
