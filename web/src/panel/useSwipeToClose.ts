import { useLayoutEffect, useRef, type PointerEvent } from 'react'
import { closesOnRelease, downwardSpeed, panelOffset, pressMove, type DragSample } from './swipeClose'

/** The app's phone layout (as App's phoneLayout and the CSS's max-width: 640px), where the panel is a bottom sheet. */
const phoneScreen = '(max-width: 640px)'
/** How long the panel takes to slide off the screen when let go to close (ms), and to spring back. */
const slideOffDuration = 180
const springBackDuration = 260

interface Press {
  pointerId: number
  startX: number
  startY: number
  dragging: boolean
  samples: DragSample[]
}

/**
 * Swiping the game panel down to close it, on a phone: a press anywhere on the panel that moves down
 * becomes a drag the panel follows. Let go past 30% of its height, or flicked down, it slides off the
 * screen and closes; otherwise it springs back (see swipeClose.ts). A press starting in the band (a
 * leaderboard, fight card or sets, which can scroll) is the band's. A drag doesn't follow the link or
 * button it started on. The panel moves by its CSS translate, so its layout, and the globe's clearance
 * of it, stay put. Returns the panel's pointer handlers.
 */
export function useSwipeToClose(gameId: string, onClose: () => void) {
  const press = useRef<Press | null>(null)
  // The game shown now, so a slide-off that ends after another game was picked doesn't close that one.
  const shownGame = useRef(gameId)
  useLayoutEffect(() => {
    shownGame.current = gameId
  }, [gameId])

  const settle = (panel: HTMLElement, translate: string, duration: number) => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    panel.style.transition = reduceMotion ? '' : `translate ${duration}ms ${translate ? 'cubic-bezier(0.4, 0, 1, 1)' : 'cubic-bezier(0.2, 0.9, 0.3, 1.25)'}`
    panel.style.translate = translate
    return reduceMotion ? 0 : duration
  }

  const end = (panel: HTMLElement) => {
    press.current = null
    delete panel.dataset.dragging
  }

  return {
    onPointerDown(event: PointerEvent<HTMLElement>) {
      if (event.button !== 0 || !window.matchMedia(phoneScreen).matches) return
      if ((event.target as Element).closest('.game-panel__band')) return
      press.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, dragging: false, samples: [] }
    },
    onPointerMove(event: PointerEvent<HTMLElement>) {
      const current = press.current
      if (!current || current.pointerId !== event.pointerId) return
      const panel = event.currentTarget
      const dy = event.clientY - current.startY
      if (!current.dragging) {
        const move = pressMove(event.clientX - current.startX, dy)
        if (move === 'tap') return
        if (move === 'not-a-drag') {
          press.current = null
          return
        }
        current.dragging = true
        panel.setPointerCapture(event.pointerId)
        panel.dataset.dragging = ''
        panel.style.transition = ''
      }
      current.samples.push({ y: event.clientY, t: event.timeStamp })
      panel.style.translate = `0 ${panelOffset(dy)}px`
    },
    onPointerUp(event: PointerEvent<HTMLElement>) {
      const current = press.current
      if (!current || current.pointerId !== event.pointerId) return
      const panel = event.currentTarget
      end(panel)
      if (!current.dragging) return
      // The click that ends the drag goes nowhere, so a drag starting on a link doesn't follow it.
      const swallow = (click: MouseEvent) => {
        click.stopPropagation()
        click.preventDefault()
      }
      window.addEventListener('click', swallow, { capture: true, once: true })
      setTimeout(() => window.removeEventListener('click', swallow, { capture: true }))
      const dy = event.clientY - current.startY
      if (!closesOnRelease(dy, downwardSpeed(current.samples), panel.offsetHeight)) {
        settle(panel, '', springBackDuration)
        return
      }
      const closing = gameId
      const after = settle(panel, '0 100%', slideOffDuration)
      setTimeout(() => {
        if (shownGame.current === closing) onClose()
        else settle(panel, '', 0)
      }, after)
    },
    onPointerCancel(event: PointerEvent<HTMLElement>) {
      const current = press.current
      if (!current || current.pointerId !== event.pointerId) return
      end(event.currentTarget)
      if (current.dragging) settle(event.currentTarget, '', springBackDuration)
    },
  }
}
