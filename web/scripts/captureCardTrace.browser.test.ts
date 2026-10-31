// Pans a globe across a scene of made-up games, as the browser tests do, and saves what the score
// cards were laid out from in each frame to CARD_TRACE, for scripts/replayCardTrace.test.ts. Skipped
// unless CARD_TRACE names where to save it. Edit the scene and the pan below to suit what you're
// looking at; they start as the crowd of "keeps cards from jumping as they settle after the globe
// stops panning across a crowd". See docs/agents/card-layout-replay.md.
import type { Map as MapLibreMap, StyleSpecification } from 'maplibre-gl'
import { expect, it, vi } from 'vitest'
import { commands } from 'vitest/browser'
import '../src/index.css'
import type { Game, GameStatus } from '../src/games/game'
import type { Camera } from '../src/globe/camera'
import { GlobeMap } from '../src/globe/globeMap'
import { cardZoom } from '../src/globe/zoomLevels'
import { applyTheme } from '../src/theme/applyTheme'
import { builtInTheme } from '../src/theme/builtInTheme'

declare module 'vitest/browser' {
  interface BrowserCommands {
    cardTracePath: () => Promise<string | null>
    saveCardTrace: (json: string) => Promise<void>
  }
}

// The globe's size on the page, where it starts, and its games: fifty venues in a spiral around 0°, 0°.
const size = { width: 800, height: 600 }
const start: Camera = { longitude: 14, latitude: 0, zoom: cardZoom + 1 }
const statuses: GameStatus[] = ['Live', 'Upcoming', 'Final']
const venues = Array.from({ length: 50 }, (_, i) => {
  const r = 0.15 * Math.sqrt(i)
  const angle = i * 2.39996
  return { id: `G${String(i).padStart(2, '0')}`, longitude: r * Math.cos(angle), latitude: r * Math.sin(angle), status: statuses[i % 3] }
})
// Where the camera's centre goes, a frame at a time: west 0.25° a frame, as a drag pans it, to −3°.
const pan = Array.from({ length: 68 }, (_, i): [number, number] => [start.longitude - 0.25 * (i + 1), start.latitude])

const plainStyle: StyleSpecification = {
  version: 8,
  sources: {},
  layers: [{ id: 'background', type: 'background', paint: { 'background-color': '#0b1526' } }],
}

function game({ id, longitude, latitude, status }: (typeof venues)[number]): Game {
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
      home: { abbreviation: 'KC', fullName: 'Kansas City Chiefs', logoUrl: null, score: 0, rank: null, record: null },
      away: { abbreviation: 'BUF', fullName: 'Buffalo Bills', logoUrl: null, score: 0, rank: null, record: null },
    },
    clock: null,
    period: null,
    clutchTime: false,
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

it('captures a pan across a scene for the card layout replay', async ({ skip }) => {
  if (!(await commands.cardTracePath())) skip('CARD_TRACE names no file to save the trace to')
  applyTheme(document.documentElement, builtInTheme)
  const container = document.createElement('div')
  container.style.cssText = `position: relative; width: ${size.width}px; height: ${size.height}px`
  document.body.append(container)
  const globe = new GlobeMap(container, { style: plainStyle, theme: builtInTheme, startCamera: start, onSelect: () => {}, onCameraMove: () => {} })
  const map = (globe as unknown as { map: MapLibreMap }).map
  try {
    globe.show(venues.map(game))
    await vi.waitFor(() => expect(globe.stage()).toBe('ready'), { timeout: 10_000 })
    // The frames from here on: the pan, then the cards settling once it stops.
    const { frames } = window.scoremap!
    frames.length = 0
    for (const center of pan) {
      map.jumpTo({ center })
      await new Promise((resolve) => map.once('render', resolve))
    }
    await vi.waitFor(() => expect(globe.settled()).toBe(true), { timeout: 10_000 })
    await commands.saveCardTrace(JSON.stringify(frames))
  } finally {
    globe.destroy()
    container.remove()
  }
})
