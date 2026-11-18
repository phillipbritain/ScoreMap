import { useEffect, useState } from 'react'
import type { Game } from '../games/game'
import type { GameDetails } from './gameDetails'

const refreshInterval = 20_000

export function useGameDetails({ id, league, status }: Game, enabled: boolean) {
  const key = new URLSearchParams({ id, league }).toString()
  const [result, setResult] = useState<{ key: string; data: GameDetails | null; failed: boolean } | null>(null)

  useEffect(() => {
    if (!enabled) return
    const controller = new AbortController()
    let timer: ReturnType<typeof setTimeout>

    async function refresh() {
      try {
        const response = await fetch(`/api/game-details?${key}`, { signal: controller.signal })
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
  }, [enabled, key, status])

  const current = result?.key === key ? result : null
  return { data: current?.data ?? null, failed: current?.failed ?? false }
}
