import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, expect, it, onTestFinished, vi } from 'vitest'
import type { Camera } from '../globe/camera'
import { zoomSettings } from '../globe/zoomLevels'
import { firstVisitSettings } from '../settings/viewerSettings'
import { touchPointer } from '../welcomeTour/welcomeTour'
import { Rail } from './Rail'

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
let root: Root | undefined

afterEach(async () => {
  await act(() => root?.unmount())
  document.body.replaceChildren()
})

async function mountRail(touring: boolean, camera: Camera | null = null) {
  const onTourAgain = vi.fn()
  const onHome = vi.fn()
  const container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
  await act(() => root!.render(createElement(Rail, {
    leagues: [], settings: firstVisitSettings, onChange: vi.fn(), accent: '#fff', camera, zoomSettings,
    onZoomIn: vi.fn(), onZoomOut: vi.fn(), onHome, touring, games: [], gamesReady: true,
    onSelectGame: vi.fn(),
    feedbackContext: () => { throw new Error('not sent') }, onTourAgain,
  })))
  return { onTourAgain, onHome }
}

const button = (label: string) => document.querySelector<HTMLButtonElement>(`.rail [aria-label^="${label}"]`)!
const usable = (element: Element) => !element.closest('[inert]')

it("keeps More, its popover and the Feedback panel usable during the welcome tour, and nothing else on the rail", async () => {
  const { onTourAgain } = await mountRail(true)
  expect(usable(button('More'))).toBe(true)
  for (const label of ['Zoom in', 'Home', 'Leagues', 'Display Settings', 'Events']) {
    expect(usable(button(label)), label).toBe(false)
  }

  await act(() => button('More').click())
  const more = document.getElementById('rail-popover')!
  expect(usable(more)).toBe(true)
  const item = (name: string) => [...document.getElementById('rail-popover')!.querySelectorAll('button')].find((candidate) => candidate.textContent?.includes(name))!
  await act(() => item('Send feedback').click())
  expect(document.getElementById('rail-popover')?.getAttribute('aria-label')).toBe('Feedback')

  await act(() => button('More').click())
  await act(() => button('More').click())
  await act(() => item('Welcome tour').click())
  expect(onTourAgain).toHaveBeenCalledOnce()
})

it('leaves every button usable once the tour is over', async () => {
  await mountRail(false)
  for (const label of ['Zoom in', 'Leagues', 'Events', 'More']) expect(usable(button(label)), label).toBe(true)
})

it('offers Home on a touchscreen with only gesture-based manual zoom', async () => {
  const matchMedia = window.matchMedia.bind(window)
  const touch = vi.spyOn(window, 'matchMedia').mockImplementation(query => matchMedia(query === touchPointer ? '(min-width: 0px)' : query))
  onTestFinished(() => { touch.mockRestore() })
  const { onHome } = await mountRail(false, { longitude: 0, latitude: 0, zoom: 16 })

  expect(button('Zoom in')).toBeNull()
  expect(button('Zoom out')).toBeNull()
  await act(() => button('Home').click())
  expect(onHome).toHaveBeenCalledOnce()
})

it('gives Leagues, Display Settings and Events a close button that closes them, and none to More', async () => {
  await mountRail(false)
  const close = () => document.querySelector<HTMLButtonElement>('#rail-popover .rail__popover-close')
  for (const label of ['Leagues', 'Display Settings', 'Events']) {
    await act(() => button(label).click())
    expect(close()?.getAttribute('aria-label'), label).toBe(`Close ${label}`)
    // A click with no pointer, as a key press makes: keyboard focus goes back to the popover's button.
    await act(() => close()!.click())
    expect(document.getElementById('rail-popover'), label).toBeNull()
    expect(document.activeElement, label).toBe(button(label))
  }
  await act(() => button('More').click())
  expect(close()).toBeNull()
  await act(() => button('More').click())
})
