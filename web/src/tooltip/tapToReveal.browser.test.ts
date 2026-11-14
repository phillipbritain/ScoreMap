import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it } from 'vitest'
import { Tooltips } from './Tooltips'

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
let root: Root

/** A line of text as the game panel has them: one line, cut short where it's longer, its link to Google Maps in it. */
function line(text: string): HTMLAnchorElement {
  const element = document.createElement('div')
  element.style.cssText = 'width: 120px; overflow: hidden; white-space: nowrap; text-overflow: ellipsis'
  element.dataset.tooltip = text
  element.toggleAttribute('data-tooltip-when-clipped', true)
  const link = document.createElement('a')
  link.href = '#maps'
  link.textContent = text
  element.append(link)
  document.body.append(element)
  return link
}

/** Presses and lets go of something with a pointer of the kind given; whether the click went on to do what it does there. */
async function press(target: Element, pointerType: 'touch' | 'mouse'): Promise<boolean> {
  let followed = false
  await act(async () => {
    target.dispatchEvent(new PointerEvent('pointerdown', { pointerType, bubbles: true }))
    target.dispatchEvent(new PointerEvent('pointerup', { pointerType, bubbles: true }))
    target.dispatchEvent(new PointerEvent('pointerout', { pointerType, bubbles: true }))
    followed = target.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
  })
  return followed
}

const tooltip = () => document.querySelector('[role="tooltip"]')?.textContent ?? null

beforeEach(async () => {
  const container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
  await act(() => root.render(createElement(Tooltips)))
})

afterEach(async () => {
  await act(() => root.unmount())
  document.body.replaceChildren()
})

it('shows cut-off text in full on a tap, in place of following its link, and follows it on a second tap', async () => {
  const link = line('Allen Fieldhouse at the James Naismith Court')

  expect(await press(link, 'touch')).toBe(false)
  expect(tooltip()).toBe('Allen Fieldhouse at the James Naismith Court')

  expect(await press(link, 'touch')).toBe(true)
  expect(tooltip()).toBeNull()
})

it('leaves a tap on text that fits to do what it does', async () => {
  const link = line('Fenway Park')

  expect(await press(link, 'touch')).toBe(true)
  expect(tooltip()).toBeNull()
})

it("leaves a mouse's click on cut-off text to do what it does", async () => {
  const link = line('Allen Fieldhouse at the James Naismith Court')

  expect(await press(link, 'mouse')).toBe(true)
  expect(tooltip()).toBeNull()
})
