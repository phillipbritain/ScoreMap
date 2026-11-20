import { createElement, act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, expect, it, vi } from 'vitest'
import type { Map as MapLibreMap } from 'maplibre-gl'
import { GlobeMap } from '../globe/globeMap'
import { cardClusterLayer } from '../globe/cardLayoutLayers'
import { zoomSettings } from '../globe/zoomLevels'
import { userEvent } from 'vitest/browser'
import type { Game } from './game'
import type { GameDetails } from '../panel/gameDetails'
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
    endTime: null,
    contest: {
      kind: 'sides',
      home: { abbreviation: 'KC', fullName: 'Kansas City Chiefs', logoUrl: null, score: home, rank: null, record: null, conference: null },
      away: { abbreviation: 'BUF', fullName: 'Buffalo Bills', logoUrl: null, score: away, rank: null, record: null, conference: null },
    },
    clock,
    period: null,
    hot: false,
    venue: { name: null, city: null, region: null, country: null, latitude, longitude, timeZone: null, photo: null, court: null },
    streamLinks: [],
    note: null,
    situation: null,
    keyEvents: [],
    topEvent: false,
    scoreline: null,
    espnUrl: null,
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
      color: '#d4ac63', textOnColor: '#000e28', venuePhotos: true, detailsOpen: false, onDetailsOpenChange: () => {},
      onClose: closeGame }),
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
  vi.unstubAllGlobals()
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
  filter.textContent = 'A filter'
  document.body.append(filter)
  filter.focus()
  await show([])
  expect(document.activeElement).toBe(filter)
  filter.remove()
})

it('selects a game from the list while it is in a card cluster', async () => {
  const games = [game('A'), game('B')]
  if (games[1].contest.kind === 'sides') games[1].contest.home.fullName = 'Second game Chiefs'
  const mapContainer = document.createElement('div')
  // Too small for both games' cards, so they gather into a card cluster.
  mapContainer.style.cssText = 'position:relative;width:120px;height:60px'
  document.body.append(mapContainer)
  const globe = new GlobeMap(mapContainer, {
    style: { version: 8, sources: {}, layers: [{ id: 'background', type: 'background', paint: { 'background-color': '#0b1526' } }] },
    zoomSettings,
    theme: builtInTheme, startCamera: { longitude: 0, latitude: 0, zoom: 4 }, onSelect: () => {}, onCameraMove: () => {}, onStage: () => {},
  })
  try {
    globe.show(games)
    const map = (globe as unknown as { map: MapLibreMap }).map
    // As long as a globe takes to start up and draw, as the globe's own tests wait.
    await vi.waitFor(() => {
      expect(map.getLayer(cardClusterLayer)).toBeDefined()
      const { x, y } = map.project([0, 0])
      expect(map.queryRenderedFeatures([[x - 30, y - 30], [x + 30, y + 30]], { layers: [cardClusterLayer] }).length).toBeGreaterThan(0)
    }, { timeout: 10_000 })
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
      home: { abbreviation: 'SIN', fullName: 'Jannik Sinner', logoUrl: null, score: '1', rank: null, record: null, conference: null },
      away: { abbreviation: 'ALC', fullName: 'Carlos Alcaraz', logoUrl: null, score: '0', rank: null, record: null, conference: null },
    },
  }
  await show([match])
  await open('T')

  expect(panelText()).toContain('Jannik Sinner')
  expect(panelText().indexOf('Jannik Sinner')).toBeLessThan(panelText().indexOf('Carlos Alcaraz'))
})

it("lines up a field's whole leaderboard in the score block, a line each, with nothing in the band", async () => {
  // The 1st to 12th entrants as "Driver A" to "Driver L", so no name is part of another.
  const letters = 'ABCDEFGHIJKL'
  const race: Game = {
    ...game('R1'),
    league: 'F1',
    sport: 'Racing',
    note: 'Driver Grand Prix',
    contest: {
      kind: 'field',
      entries: Array.from({ length: 12 }, (_, i) => ({ position: i + 1, name: `Driver ${letters[i]}`, shortName: `D. ${letters[i]}`, flagUrl: null, score: null, logoUrl: null })),
    },
  }
  await show([race])
  await open('R1')
  const names = (selector: string) =>
    [...container.querySelectorAll(`${selector} .game-panel__team-name`)].map((name) => name.textContent)
  expect(names('.game-panel__score')).toEqual([...letters].map((letter, i) => `${i + 1} Driver ${letter}`))
  expect(container.querySelector('.game-panel__band')).toBeNull()
  expect([...container.querySelectorAll('.game-panel button')].map((button) => button.textContent)).not.toContain('Show all 12')
})

it("shows a fight card side's score chip only for the winner", async () => {
  const side = (name: string, winner: boolean) => ({ name, shortName: name, flagUrl: null, record: null, winner })
  const bout = (id: string, status: 'Upcoming' | 'Final', winner: boolean) => ({
    id, first: side(`${id} first`, winner), second: side(`${id} second`, false), weightClass: null, scheduledRounds: 3,
    status, round: null, clock: null, method: winner ? 'Decision' : null,
  })
  const card = (id: string, main: ReturnType<typeof bout>): Game => ({ ...game(id), league: 'UFC', sport: 'MMA', contest: { kind: 'bouts', bouts: [main] } })
  await show([card('U1', bout('upcoming', 'Upcoming', false)), card('U2', bout('won', 'Final', true))])
  const chips = () => [...container.querySelectorAll('.game-panel__score .game-panel__team-score')].map((chip) => chip.firstElementChild?.textContent)

  await open('U1')
  expect(chips()).toEqual([])
  await open('U2')
  expect(chips()).toEqual(['W'])
})

it("links the panel to a game's StreamEast stream and ESPN page, and has no links for a game with neither", async () => {
  const linked: Game = {
    ...game('W'),
    streamLinks: [{ site: 'StreamEast', url: 'https://streameast.test/nfl/game/1' }],
    espnUrl: 'https://www.espn.com/nfl/game/_/gameId/1',
  }
  const links = () => [...document.querySelectorAll<HTMLAnchorElement>('dialog[open] a')].map((a) => a.href)
  vi.stubGlobal('fetch', vi.fn(async () => Response.json(details)))
  await show([game('N'), linked])

  await open('N')
  await clickTv()
  expect(links()).toEqual([])
  await userEvent.keyboard('{Escape}')

  await open('W')
  expect(links()).toEqual([])
  await clickTv()
  expect(links()).toEqual(['https://streameast.test/nfl/game/1', 'https://www.espn.com/nfl/game/_/gameId/1'])
  expect(container.querySelector('dialog[open]')?.textContent).toContain('ESPN2')
})


const details: GameDetails = {
  periodScores: [{ label: 'Q1', home: '7', away: '0' }],
  homeTotal: '7',
  awayTotal: '0',
  scoring: [{ team: 'KC', text: 'Seven-yard touchdown run', when: 'Q1 9:00', homeScore: 7, awayScore: 0 }],
  drives: [{ team: 'KC', outcome: 'Touchdown', scored: true, plays: 8, yards: 75, duration: '4:30', start: 'KC 25', end: 'BUF 0' }],
  stats: [{ team: 'KC', sections: [{ name: 'Passing', columns: ['YDS'], players: [{ name: 'Patrick Mahomes', values: ['40'] }] }] }],
  videos: [{ title: 'Game highlights', url: 'https://www.espn.com/video/clip?id=1', duration: 45 }],
  broadcasts: ['ESPN2'],
}

async function clickTv() {
  const button = container.querySelector<HTMLButtonElement>('button[aria-label="Watch and game info"]')!
  await act(async () => button.click())
}

it('loads details on opening a tab and collapses them without closing the game', async () => {
  const fetchDetails = vi.fn(async () => Response.json(details))
  vi.stubGlobal('fetch', fetchDetails)
  const tab = (label: string) => [...container.querySelectorAll<HTMLButtonElement>('[role="tab"]')]
    .find((button) => button.textContent === label)!
  const pane = () => container.querySelector('[role="tabpanel"]')!
  await show([game('A'), game('B')])

  await open('A')
  expect(pane().closest('[inert]')).not.toBeNull()
  expect(fetchDetails).not.toHaveBeenCalled()

  await act(async () => tab('Score').click())
  expect(pane().closest('[inert]')).toBeNull()
  expect(pane().textContent).toContain('Q1')
  expect(fetchDetails).toHaveBeenCalledExactlyOnceWith('/api/game-details?id=A&league=NFL', expect.any(Object))

  await act(async () => tab('Scoring').click())
  expect(pane().textContent).toContain('Seven-yard touchdown run')
  await act(async () => tab('Drives').click())
  expect(pane().textContent).toContain('75 yards')
  await act(async () => tab('Stats').click())
  expect(pane().textContent).toContain('Patrick Mahomes')
  await act(async () => tab('Videos').click())
  const video = pane().querySelector('a')!
  expect(video.href).toBe('https://www.espn.com/video/clip?id=1')
  expect(video.target).toBe('_blank')
  expect(fetchDetails).toHaveBeenCalledTimes(1)

  const collapse = container.querySelector<HTMLButtonElement>('button[aria-label="Minimize game details"]')!
  await act(async () => collapse.click())
  expect(pane().closest('[inert]')).not.toBeNull()
  expect(document.activeElement).toBe(tab('Videos'))
  expect(container.querySelector('.game-panel')).not.toBeNull()

  await open('B')
  expect(pane().closest('[inert]')).not.toBeNull()
  await open('A')
  expect(pane().closest('[inert]')).not.toBeNull()
  expect(fetchDetails).toHaveBeenCalledTimes(1)
})
