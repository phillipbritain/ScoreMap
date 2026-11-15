// PROTOTYPE, throw away: the game panel's confetti when its game ends, then its closing itself, and the
// floating bar is ConfettiPrototypeBar (see globe/confettiPrototype.ts). Local runs only.
import { useEffect, useRef, useState, type RefObject } from 'react'
import type { Game } from '../games/game'
import { celebrateInPanel, confettiVariant, reducedMotion, type CloseLook } from '../globe/confettiPrototype'

/** Where the selected game's pin is on the page: its score card, else above the panel. */
function pinPoint(gameId: string, panel: DOMRect): { x: number; y: number } {
  const card = document.querySelector(`.maplibregl-marker [data-game-id="${CSS.escape(gameId)}"]`)
  const box = card?.getBoundingClientRect()
  if (box && box.width > 0) return { x: box.left + box.width / 2, y: box.top + box.height / 2 }
  return { x: panel.left + panel.width / 2, y: panel.top - 140 }
}

function closeAnimation(panel: HTMLElement, look: CloseLook, gameId: string): Animation {
  const base = getComputedStyle(panel).transform
  const start = base === 'none' ? '' : base
  const box = panel.getBoundingClientRect()
  if (look === 'fade') {
    return panel.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 450, easing: 'ease-out', fill: 'forwards' })
  }
  if (look === 'slide') {
    const drop = innerHeight - box.top + 24
    return panel.animate([{ transform: `translateY(0) ${start}` }, { transform: `translateY(${drop}px) ${start}` }], { duration: 550, easing: 'cubic-bezier(.5,0,.8,.4)', fill: 'forwards' })
  }
  if (look === 'fold') {
    panel.style.transformOrigin = 'bottom center'
    return panel.animate([{ transform: `${start} scaleY(1)`, opacity: 1 }, { transform: `${start} scaleY(0)`, opacity: 0.2 }], { duration: 420, easing: 'cubic-bezier(.6,0,.9,.6)', fill: 'forwards' })
  }
  // Shrink into the pin: scaled about its own center, which moves to the pin.
  panel.style.transformOrigin = 'center center'
  const to = pinPoint(gameId, box)
  const dx = to.x - (box.left + box.width / 2)
  const dy = to.y - (box.top + box.height / 2)
  return panel.animate(
    [
      { transform: `translate(0, 0) ${start} scale(1)`, opacity: 1 },
      { transform: `translate(${dx}px, ${dy}px) ${start} scale(0.04)`, opacity: 0.1 },
    ],
    { duration: 650, easing: 'cubic-bezier(.55,0,.75,.2)', fill: 'forwards' },
  )
}

/**
 * When the open panel's game ends: confetti up from the panel's bottom corners, then, after the
 * variant's wait, the panel closes itself with the variant's way out, in place of the default one: it
 * sets the panel's data-leave, plays it, and gives its duration, for useLeaving to keep the panel that
 * long (see .game-panel--leaving). Picking another game or closing it first stops it. With reduce
 * motion, no confetti, and the panel goes at once, as any close does.
 */
export function usePanelConfetti(game: Game | null, panel: RefObject<HTMLElement | null>, color: string | null, close: () => void): number | null {
  const last = useRef<{ id: string; status: string; color: string | null } | null>(null)
  // A close still to come, and for which game.
  const pending = useRef<{ id: string; timer: ReturnType<typeof setTimeout> } | null>(null)
  // The way out's duration, for the game whose panel is closing itself.
  const [leave, setLeave] = useState<{ id: string; duration: number } | null>(null)
  const id = game?.id ?? null
  const status = game?.status ?? null
  useEffect(() => {
    if (!import.meta.env.DEV || !game || !id) {
      last.current = null
      return
    }
    const was = last.current
    last.current = { id, status: game.status, color: game.status === 'Final' ? (was?.id === id ? was.color : color) : color }
    if (!was || was.id !== id || was.status === 'Final' || game.status !== 'Final') return
    const element = panel.current
    if (!element) return
    const variant = confettiVariant()
    void celebrateInPanel(element, game, was.color ?? color ?? '#f3ca81')
    // Kept until this panel closes or another game's opens, not undone by the game changing again (as
    // the server's next change does to a made-up finish).
    const timer = setTimeout(() => {
      pending.current = null
      if (reducedMotion()) {
        close()
        return
      }
      element.dataset.leave = `confetti-${variant.close}`
      const animation = closeAnimation(element, variant.close, id)
      setLeave({ id, duration: Number(animation.effect?.getTiming().duration ?? 0) })
      close()
    }, variant.closeAfter)
    pending.current = { id, timer }
    // Only the game and its status matter; close changes with each selection.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, status])
  // Closing the panel or opening another game's stops a close still to come.
  useEffect(() => () => {
    if (pending.current?.id === id) {
      clearTimeout(pending.current.timer)
      pending.current = null
    }
  }, [id])
  return leave && (id === null || id === leave.id) ? leave.duration : null
}
