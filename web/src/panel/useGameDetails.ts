import { useEffect, useRef, useState } from 'react'
import type { Game } from '../games/game'
import type { GameDetails } from './gameDetails'

const refreshInterval = 20_000

/** The welcome tour's games are made up in the browser; the server makes up their details from the game sent. */
export const isTourGame = ({ id }: Game) => id.startsWith('tour-')

/**
 * The selected game's details, refreshed while it's Live: a game on the board by its id, a demo's game
 * on the demo board, and a tour game by sending the game as it is now.
 */
export function useGameDetails(game: Game, enabled: boolean, demo = false) {
  const { id, league, status } = game
  const tour = isTourGame(game)
  const key = new URLSearchParams({ id, league, ...(demo && !tour ? { demo: 'true' } : {}) }).toString()
  const current = useRef(game)
  useEffect(() => {
    current.current = game
  })
  const [result, setResult] = useState<{ key: string; data: GameDetails | null; failed: boolean } | null>(null)

  useEffect(() => {
    if (!enabled) return
    const controller = new AbortController()
    let timer: ReturnType<typeof setTimeout>

    async function refresh() {
      try {
        const response = tour
          ? await fetch('/api/tour-game-details', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(current.current),
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
        if (!controller.signal.aborted && status === 'Live') timer = setTimeout(() => void refresh(), refreshInterval)
      }
    }

    void refresh()
    return () => {
      controller.abort()
      clearTimeout(timer)
    }
  }, [enabled, key, status, tour])

  const shown = result?.key === key ? result : null
  return { data: shown?.data ?? null, failed: shown?.failed ?? false }
}
