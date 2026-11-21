import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, expect, it, vi } from 'vitest'
import type { TourGame } from '../welcomeTour/tourGame'
import { tourGames, tourGameToTry } from '../welcomeTour/tourGames'
import { tourPlayStart, tourPlayTick } from '../welcomeTour/tourPlay'
import type { GameDetails } from './gameDetails'
import { useGameDetails } from './useGameDetails'

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })

let root: Root | undefined

afterEach(async () => {
  await act(() => root?.unmount())
  root = undefined
  document.body.replaceChildren()
  vi.unstubAllGlobals()
})

it('refreshes tour Game details when the period, note, or numeric score changes', async () => {
  const game = tourGames(Date.now()).find(({ id }) => id === tourGameToTry)!
  const fetchDetails = vi.fn(async (_url: string, { body }: { body: string }) => {
    const { period, note, homeScore, awayScore } = JSON.parse(body)
    return Response.json({
      periodScores: [{ label: `Q${period}`, home: null, away: null }],
      homeTotal: String(homeScore), awayTotal: String(awayScore),
      broadcasts: note ? [note] : [],
      scoring: [], drives: [], stats: [], videos: [],
    } satisfies GameDetails)
  })
  vi.stubGlobal('fetch', fetchDetails)
  function Details({ game }: { game: TourGame }) {
    const { data } = useGameDetails(game, true)
    return createElement('output', null, data && [
      data.periodScores[0].label, data.broadcasts[0] ?? '', data.homeTotal, data.awayTotal,
    ].join('|'))
  }
  const container = document.createElement('div')
  document.body.append(container)
  const mounted = createRoot(container)
  root = mounted
  const show = (game: TourGame) => act(() => mounted.render(createElement(Details, { game })))
  const lastRequest = () => JSON.parse(fetchDetails.mock.lastCall![1].body)

  await show(game)
  expect(fetchDetails).toHaveBeenCalledExactlyOnceWith('/api/tour-game-details', expect.objectContaining({ method: 'POST' }))
  expect(lastRequest()).toMatchObject({ period: 3, note: null, phase: 'Playing', homeScore: 13, awayScore: 17 })

  const relabeled = {
    ...game,
    clock: 'Third quarter, six minutes left',
    contest: { ...game.contest, home: { ...game.contest.home, score: '13 points' } },
  }
  await show(relabeled)
  expect(fetchDetails).toHaveBeenCalledTimes(1)

  const fourth = { ...relabeled, period: 4 }
  await show(fourth)
  expect(fetchDetails).toHaveBeenCalledTimes(2)
  expect(lastRequest()).toMatchObject({ period: 4, note: null })
  expect(container.textContent).toBe('Q4||13|17')

  const withNote = { ...fourth, note: 'Divisional round' }
  await show(withNote)
  expect(fetchDetails).toHaveBeenCalledTimes(3)
  expect(lastRequest()).toMatchObject({ period: 4, note: 'Divisional round' })
  expect(container.textContent).toBe('Q4|Divisional round|13|17')

  const played = tourPlayTick(tourPlayStart([withNote]), withNote.id, 0).games[0]
  await show(played)
  expect(fetchDetails).toHaveBeenCalledTimes(4)
  expect(lastRequest()).toMatchObject({ homeScore: 16, awayScore: 17 })
  expect(container.textContent).toBe('Q4|Divisional round|16|17')
})
