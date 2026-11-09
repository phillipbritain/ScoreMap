import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, expect, it, vi } from 'vitest'
import { userEvent } from 'vitest/browser'
import type { StyleSpecification } from 'maplibre-gl'
import type { PlacedGame } from '../games/placedGames'
import { GlobeMap } from '../globe/globeMap'
import type { ShownScoreCard } from '../globe/scoreCardMarkers'
import { cardZoom, unfittedZoom } from '../globe/zoomLevels'
import { applyTheme } from '../theme/applyTheme'
import { builtInTheme } from '../theme/builtInTheme'
import { firstVisitSettings } from '../settings/viewerSettings'
import { WelcomeTourScreen } from './WelcomeTourScreen'
import '../index.css'

// Click a score card, pointing at cards the globe gives it (see GlobeMap.shownScoreCards). The cards
// here are plain boxes on the page: what the step does with them doesn't depend on how a card looks.

applyTheme(document.documentElement, builtInTheme)
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
let root: Root | undefined

const opened: GlobeMap[] = []

afterEach(async () => {
  await act(() => root?.unmount())
  root = undefined
  for (const globe of opened.splice(0)) globe.destroy()
  document.body.replaceChildren()
})

interface FakeCard {
  gameId: string
  label: string
  element: HTMLElement
}

/** A card-sized box at a place on the page (1024 × 768 in the browser tests). */
function fakeCard(gameId: string, label: string, left: number, top: number): FakeCard {
  const element = document.createElement('div')
  element.style.cssText = `position: fixed; left: ${left}px; top: ${top}px; width: 120px; height: 60px`
  document.body.append(element)
  return { gameId, label, element }
}

async function mountStep(cards: FakeCard[]) {
  return mountStepOn(() =>
    cards.map(({ gameId, label, element }) => ({ gameId, label, element, box: element.getBoundingClientRect(), rows: [element] })),
  )
}

async function mountStepOn(scoreCards: () => ShownScoreCard[]) {
  const onOpenGame = vi.fn<(gameId: string) => void>()
  const onEvent = vi.fn()
  const container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
  await act(() =>
    root!.render(
      createElement(WelcomeTourScreen, {
        progress: 'scoreCard',
        onEvent,
        leagueList: { status: 'ready', leagues: [], retry: () => {} },
        settings: firstVisitSettings,
        onChange: () => {},
        onOpenGame,
        scoreCards,
      }),
    ),
  )
  return { onOpenGame, onEvent }
}

/** The lit card's button, by its name. */
const openButton = () => document.querySelector<HTMLButtonElement>('button[aria-label^="Open "]')

it('points at a card clear of the panel, named as its game, and opens its game when pressed', async () => {
  const label = 'NFL · Buffalo Bills 17 vs Kansas City Chiefs 21 · Live · Q3 4:12'
  const { onOpenGame, onEvent } = await mountStep([fakeCard('A', label, 40, 40)])

  await vi.waitFor(() => expect(openButton()?.getAttribute('aria-label')).toBe(`Open ${label}`))
  await userEvent.click(openButton()!)

  expect(onOpenGame).toHaveBeenCalledWith('A')
  expect(onEvent).toHaveBeenCalledWith({ kind: 'gameOpened' })
})

it('shows the example card, and nothing to press, when no card is clear of the panel', async () => {
  // In the middle of the page, under the panel.
  await mountStep([fakeCard('A', 'NFL · Buffalo Bills vs Kansas City Chiefs', 452, 354)])

  await vi.waitFor(() => expect(document.querySelector('[aria-label="An example score card"]')).not.toBeNull())
  expect(openButton()).toBeNull()
})

it('keeps pointing at its card while it stays clear, though another comes nearer the middle', async () => {
  const cards = [fakeCard('A', 'Game A', 40, 40)]
  const { onOpenGame } = await mountStep(cards)
  await vi.waitFor(() => expect(openButton()?.getAttribute('aria-label')).toBe('Open Game A'))

  // Above the panel, nearer the middle of the page than A.
  cards.push(fakeCard('B', 'Game B', 452, 40))
  await new Promise((resolve) => setTimeout(resolve, 200))

  expect(openButton()?.getAttribute('aria-label')).toBe('Open Game A')
  await userEvent.click(openButton()!)
  expect(onOpenGame).toHaveBeenCalledWith('A')
})

it("renames its button as its game's name changes, with a new score", async () => {
  const card = fakeCard('A', 'NFL · Buffalo Bills 17 vs Kansas City Chiefs 21 · Live', 40, 40)
  await mountStep([card])
  await vi.waitFor(() => expect(openButton()?.getAttribute('aria-label')).toContain('Kansas City Chiefs 21'))

  card.label = 'NFL · Buffalo Bills 17 vs Kansas City Chiefs 28 · Live'

  await vi.waitFor(() => expect(openButton()?.getAttribute('aria-label')).toContain('Kansas City Chiefs 28'))
})

const plainStyle: StyleSpecification = {
  version: 8,
  sources: {},
  layers: [{ id: 'background', type: 'background', paint: { 'background-color': '#0b1526' } }],
}

/** A Live football game, its venue up and to the left of the globe's middle, so its card is clear of the panel. */
const bills: PlacedGame = {
  id: 'A',
  league: 'NFL',
  sport: 'Football',
  startTime: '2026-10-04T17:00:00+00:00',
  status: 'Live',
  delayed: false,
  disruption: null,
  endTime: null,
  contest: {
    kind: 'sides',
    home: { abbreviation: 'KC', fullName: 'Kansas City Chiefs', logoUrl: null, score: '21', rank: null, record: null },
    away: { abbreviation: 'BUF', fullName: 'Buffalo Bills', logoUrl: null, score: '17', rank: null, record: null },
  },
  clock: null,
  period: null,
  clutchTime: false,
  hot: false,
  venue: { name: null, city: null, region: null, country: null, latitude: 20, longitude: -35, timeZone: null, photo: null, court: null },
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

it("points at a card on the globe, named as the card's own button names its game, and opens it", async () => {
  const map = document.createElement('div')
  map.style.cssText = 'position: fixed; inset: 0'
  document.body.append(map)
  const globe = new GlobeMap(map, {
    style: plainStyle, theme: builtInTheme, zoomSettings: unfittedZoom, startCamera: { longitude: 0, latitude: 0, zoom: cardZoom },
    onSelect: () => {}, onCameraMove: () => {}, onStage: () => {},
  })
  opened.push(globe)
  globe.show([bills])
  await vi.waitFor(() => expect(globe.shownScoreCards()).toHaveLength(1), { timeout: 10_000 })
  const { onOpenGame } = await mountStepOn(() => globe.shownScoreCards())

  const cardButton = globe.shownScoreCards()[0].element
  await vi.waitFor(() => expect(openButton()?.getAttribute('aria-label')).toBe(`Open ${cardButton.getAttribute('aria-label')}`))
  expect(openButton()!.getAttribute('aria-label')).toContain('Buffalo Bills 17 vs Kansas City Chiefs 21')
  await userEvent.click(openButton()!)

  expect(onOpenGame).toHaveBeenCalledWith('A')
})
