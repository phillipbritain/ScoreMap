import { afterEach, describe, expect, it } from 'vitest'
import '../index.css'
import { applyTheme } from '../theme/applyTheme'
import { builtInTheme } from '../theme/builtInTheme'
import { panelBox } from './panelBox'

applyTheme(document.documentElement, builtInTheme)

let area: HTMLElement | null = null

afterEach(() => {
  area?.remove()
  area = null
})

/** A event panel opening on a globe area the size of a desktop's, as the app's does: sliding in from below. */
function openPanel(): HTMLElement {
  area = document.createElement('div')
  area.style.cssText = 'position: relative; width: 1280px; height: 800px; overflow: hidden'
  const panel = document.createElement('div')
  panel.className = 'event-panel'
  panel.style.height = '200px'
  area.append(panel)
  document.body.append(area)
  return panel
}

const rounded = (box: { left: number; top: number; right: number; bottom: number }) =>
  [box.left, box.top, box.right, box.bottom].map(Math.round)

describe('panelBox', () => {
  it('is where the panel comes to rest, measured as it starts to slide in', async () => {
    const panel = openPanel()

    const opening = panelBox(panel)
    // Still below its resting place, as the globe would see it on the page.
    expect(panel.getBoundingClientRect().top).toBeGreaterThan(opening.top + 100)

    await Promise.all(panel.getAnimations().map((animation) => animation.finished))
    expect(rounded(opening)).toEqual(rounded(panel.getBoundingClientRect()))
  })
})
