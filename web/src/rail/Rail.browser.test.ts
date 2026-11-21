import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, expect, it, vi } from 'vitest'
import { zoomSettings } from '../globe/zoomLevels'
import { firstVisitSettings } from '../settings/viewerSettings'
import { Rail } from './Rail'

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
let root: Root | undefined

afterEach(async () => {
  await act(() => root?.unmount())
  document.body.replaceChildren()
})

async function mountRail(touring: boolean) {
  const onTourAgain = vi.fn()
  const container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
  await act(() => root!.render(createElement(Rail, {
    leagues: [], settings: firstVisitSettings, onChange: vi.fn(), accent: '#fff', camera: null, zoomSettings,
    onZoomIn: vi.fn(), onZoomOut: vi.fn(), onHome: vi.fn(), touring, games: [], gamesReady: true,
    onSelectGame: vi.fn(), collapsed: false, onCollapsedChange: vi.fn(),
    feedbackContext: () => { throw new Error('not sent') }, onTourAgain,
  })))
  return { onTourAgain }
}

const button = (label: string) => document.querySelector<HTMLButtonElement>(`.rail [aria-label^="${label}"]`)!
const usable = (element: Element) => !element.closest('[inert]')

it("keeps More, its popover and the Feedback panel usable during the welcome tour, and nothing else on the rail", async () => {
  const { onTourAgain } = await mountRail(true)
  expect(usable(button('More'))).toBe(true)
  for (const label of ['Hide controls', 'Zoom in', 'Home', 'Leagues', 'Display Settings', 'Map Type', 'Games']) {
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
  for (const label of ['Hide controls', 'Zoom in', 'Leagues', 'Games', 'More']) expect(usable(button(label)), label).toBe(true)
})
