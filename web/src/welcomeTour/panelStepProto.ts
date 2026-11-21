// PROTOTYPE (throwaway): how the game panel's steps sit, switched by ?panelStepProto= or the [ and ] keys.
// Arrow: today's, the step in the middle (or above the panel) with an arrow to the lit part.
// Above: the step right above the lit part, with no arrow.
import { useEffect, useState, type RefObject } from 'react'

export type PanelStepProto = 'arrow' | 'above'
const variants: readonly PanelStepProto[] = ['arrow', 'above']
const param = 'panelStepProto'

function fromUrl(): PanelStepProto {
  const value = new URLSearchParams(window.location.search).get(param)
  return variants.find((variant) => variant === value) ?? 'arrow'
}

export function usePanelStepProto(): PanelStepProto {
  const [variant, setVariant] = useState(fromUrl)
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== '[' && event.key !== ']') return
      setVariant((current) => {
        const next = variants[(variants.indexOf(current) + (event.key === ']' ? 1 : variants.length - 1)) % variants.length]
        const url = new URL(window.location.href)
        url.searchParams.set(param, next)
        window.history.replaceState(null, '', url)
        return next
      })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  return variant
}

/** Above: keeps the step's panel right above the lit part, centered on it and kept on screen. */
export function useAboveLitPart(on: boolean, panel: RefObject<HTMLElement | null>, part: () => Iterable<Element>) {
  useEffect(() => {
    const element = panel.current
    if (!on || !element) return
    let frame = 0
    const look = () => {
      frame = requestAnimationFrame(look)
      const layer = element.closest('.welcome-tour')?.getBoundingClientRect()
      const target = [...part()][0]?.getBoundingClientRect()
      const gamePanel = document.querySelector('.game-panel:not(.game-panel--leaving)')?.getBoundingClientRect()
      if (!layer || !target || !gamePanel) return
      const gap = 16
      const width = element.offsetWidth
      const height = element.offsetHeight
      // Kept over the game panel's width, so it stays clear of the rail.
      const least = Math.max(8, gamePanel.left - layer.left)
      const most = Math.min(layer.width - 8, gamePanel.right - layer.left) - width
      const left = Math.max(least, Math.min(target.left - layer.left + target.width / 2 - width / 2, most))
      const top = Math.max(8, target.top - layer.top - gap - height)
      element.style.position = 'absolute'
      element.style.left = `${left}px`
      element.style.top = `${top}px`
    }
    look()
    return () => {
      cancelAnimationFrame(frame)
      element.style.removeProperty('position')
      element.style.removeProperty('left')
      element.style.removeProperty('top')
    }
  }, [on, panel, part])
}
