import { useEffect, useState } from 'react'
import type { Game, GameTeam } from '../games/game'
import type { TourGame } from '../welcomeTour/tourGame'
import type { GameDetails } from './gameDetails'

const refreshInterval = 20_000

function isTourGame(game: Game): game is TourGame {
  return 'tourPlay' in game
}

function tourDetailsBody({ id, league, status, period, note, contest, tourPlay }: TourGame): string {
  const team = ({ abbreviation, fullName, logoUrl }: GameTeam) => ({ abbreviation, fullName, logoUrl })
  const { phase, scores, clock } = tourPlay
  return JSON.stringify({
    id, league, status, period, note, phase,
    contest: { kind: contest.kind, home: team(contest.home), away: team(contest.away) },
    homeScore: scores.home, awayScore: scores.away,
    minute: clock.kind === 'minute' ? clock.minute : null,
  })
}

/**
 * The selected game's details, refreshed while it's Live or its Final Videos are open: a game on the board by its id, a demo's game
 * on the demo board, and a tour game by sending the facts its details are made from.
 */
export function useGameDetails(game: Game, enabled: boolean, demo = false, showingVideos = false) {
  const { id, league, status } = game
  const body = isTourGame(game) ? tourDetailsBody(game) : null
  const refreshWhileOpen = status === 'Live' || (status === 'Final' && showingVideos && !demo && body === null)
  const key = new URLSearchParams({ id, league, ...(demo && body === null ? { demo: 'true' } : {}) }).toString()
  const [result, setResult] = useState<{ key: string; data: GameDetails | null; failed: boolean } | null>(null)

  useEffect(() => {
    if (!enabled) return
    const controller = new AbortController()
    let timer: ReturnType<typeof setTimeout>

    async function refresh() {
      try {
        const response = body !== null
          ? await fetch('/api/tour-game-details', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body,
            signal: controller.signal,
          })
          : await fetch(`/api/game-details?${key}`, { signal: controller.signal })
        if (!response.ok) throw new Error('Game details request failed')
        const data: GameDetails = await response.json()
        if (!controller.signal.aborted) setResult({ key, data, failed: false })
      } catch {
        if (!controller.signal.aborted) {
          setResult((before) => ({ key, data: before?.key === key ? before.data : null, failed: true }))
        }
      } finally {
        if (!controller.signal.aborted && refreshWhileOpen) timer = setTimeout(() => void refresh(), refreshInterval)
      }
    }

    void refresh()
    return () => {
      controller.abort()
      clearTimeout(timer)
    }
  }, [enabled, key, status, body, refreshWhileOpen])

  const shown = result?.key === key ? result : null
  return { data: shown?.data ?? null, failed: shown?.failed ?? false }
}
