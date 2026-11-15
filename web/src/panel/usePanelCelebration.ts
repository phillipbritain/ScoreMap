import { useEffect, useRef, type RefObject } from 'react'
import { finishedWhileShown, type SeenGame } from '../celebration/celebrated'
import { fireworksInPanel } from '../celebration/celebration'
import { teamColors } from '../celebration/teamColors'
import type { Game } from '../games/game'

/** From the finish to the panel closing itself, in milliseconds: the fireworks show and a moment after. */
export const celebrationLength = 4200

/**
 * How long a panel closing itself after its game's celebration takes to go, in milliseconds: it slides
 * down slower than a close does (see .game-panel--leaving[data-leave='celebrated']).
 */
export const celebratedPanelLeaveDuration = 550

/**
 * The game panel's part in a game's celebration (see GLOSSARY.md "Celebration"): when its game finishes
 * while it's open, a fireworks show inside it in the teams' colors (`gameColor` and white where they
 * can't be read), then, `celebrationLength` after the finish, it closes itself, sliding down its own way
 * (its data-leave), as `onCelebrated` takes the game off the globe. Closing the panel first, or picking
 * another game, stops it. With reduce motion there's no show, but it still closes itself.
 */
export function usePanelCelebration(game: Game | null, panel: RefObject<HTMLElement | null>, gameColor: string | null, onCelebrated: (gameId: string) => void): void {
  const seen = useRef<SeenGame | null>(null)
  // The latest, for the close to come: the callback changes as the games do.
  const celebrated = useRef(onCelebrated)
  useEffect(() => {
    celebrated.current = onCelebrated
  })
  const id = game?.id ?? null
  const status = game?.status ?? null
  // The game's color as it played: a Final game takes Final's.
  const color = useRef<string | null>(null)
  if (status !== 'Final') color.current = gameColor

  useEffect(() => {
    const before = seen.current
    seen.current = id && status ? { id, status } : null
    if (!game || !id || !finishedWhileShown(before, seen.current)) return
    const element = panel.current
    if (!element) return
    void teamColors(game, color.current ?? gameColor ?? '#ffffff').then((colors) => {
      if (element.isConnected) fireworksInPanel(element, colors)
    })
    const timer = setTimeout(() => {
      element.dataset.leave = 'celebrated'
      celebrated.current(id)
    }, celebrationLength)
    return () => clearTimeout(timer)
    // Only the game and its status matter: a finish is a change of status.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, status])
}
