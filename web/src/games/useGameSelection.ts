import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { Game } from './game'
import { focusGameNavigation } from './gameFocus'

/** Current selection and the keyboard's journey into and back from the game panel. */
export function useGameSelection(games: readonly Game[]) {
  const [selectedGameId, setSelectedGameId] = useState<string | null>(null)
  const panel = useRef<HTMLElement>(null)
  const origin = useRef<HTMLElement | null>(null)
  const focusPanel = useRef(false)
  const focused = useRef<HTMLElement | null>(null)
  const selectedGame = games.find((game) => game.id === selectedGameId) ?? null
  // Forget a hidden/removed selection so it cannot reopen if the game returns.
  if (!selectedGame && selectedGameId !== null) setSelectedGameId(null)

  useEffect(() => {
    const remember = (event: FocusEvent) => {
      const target = event.target
      focused.current = target instanceof HTMLElement && (target.closest('[data-game-id]') || panel.current?.contains(target))
        ? target : null
    }
    document.addEventListener('focusin', remember)
    return () => document.removeEventListener('focusin', remember)
  }, [])

  const returnFocus = useCallback(() => {
    const source = origin.current
    if (source?.isConnected && !source.closest('[inert]') && source.checkVisibility({ visibilityProperty: true })) source.focus({ preventScroll: true })
    else focusGameNavigation()
    origin.current = null
  }, [])

  useLayoutEffect(() => {
    if (selectedGame && focusPanel.current) {
      panel.current?.querySelector<HTMLElement>('.game-panel__close')?.focus({ preventScroll: true })
      focusPanel.current = false
    } else if (focused.current && !focused.current.isConnected && document.activeElement === document.body) {
      // A filter or a feed removal detached the focused panel or control.
      returnFocus()
    }
  })

  const selectGame = useCallback((gameId: string) => {
    const active = document.activeElement
    const keyboard = active instanceof HTMLElement && active.dataset.gameId === gameId && active.matches(':focus-visible')
    origin.current = keyboard ? active : null
    focusPanel.current = keyboard
    setSelectedGameId(gameId)
    if (keyboard && gameId === selectedGameId) {
      panel.current?.querySelector<HTMLElement>('.game-panel__close')?.focus({ preventScroll: true })
      focusPanel.current = false
    }
  }, [selectedGameId])

  const closeGame = useCallback(() => {
    setSelectedGameId(null)
    returnFocus()
  }, [returnFocus])

  return { selectedGame, panel, selectGame, closeGame }
}
