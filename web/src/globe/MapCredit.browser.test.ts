import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, expect, it } from 'vitest'
import { MapCredit } from './MapCredit'

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
let root: Root | undefined

afterEach(async () => {
  await act(() => root?.unmount())
  document.body.replaceChildren()
})

async function mount(hidden: boolean) {
  const container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
  await act(() => root!.render(createElement(MapCredit, { hidden })))
}

const button = () => document.querySelector<HTMLButtonElement>('button[aria-label="Map credits"]')!
const credit = () => document.getElementById(button().getAttribute('aria-controls')!)!
const shown = (element: Element) => element.checkVisibility()

/** A click as a pointer makes one: down, then the click, where a click away looks for both. */
async function clickOn(element: Element) {
  await act(() => {
    element.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    ;(element as HTMLElement).click()
  })
}

it('shows only its button on the satellite map, and nothing on the plain map', async () => {
  await mount(false)
  expect(shown(button())).toBe(true)
  expect(shown(credit())).toBe(false)
  await act(() => root!.render(createElement(MapCredit, { hidden: true })))
  expect(shown(button())).toBe(false)
})

it('opens the credit, with its link, on a click, and closes it on another', async () => {
  await mount(false)
  await clickOn(button())
  expect(button().getAttribute('aria-expanded')).toBe('true')
  expect(shown(credit())).toBe(true)
  expect(credit().textContent).toContain('EOxCloudless')
  expect(credit().querySelector('a')?.href).toBe('https://cloudless.eox.at/')
  await clickOn(button())
  expect(button().getAttribute('aria-expanded')).toBe('false')
  expect(shown(credit())).toBe(false)
})

it('keeps the credit open for a click in it, and closes it on a click away', async () => {
  await mount(false)
  const away = document.createElement('div')
  document.body.append(away)
  await clickOn(button())
  await clickOn(credit())
  expect(shown(credit())).toBe(true)
  await clickOn(away)
  expect(shown(credit())).toBe(false)
})

it('closes the credit on Escape, back on its button', async () => {
  await mount(false)
  await act(() => button().focus())
  await clickOn(button())
  credit().querySelector('a')!.focus()
  await act(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })))
  expect(shown(credit())).toBe(false)
  expect(document.activeElement).toBe(button())
})
