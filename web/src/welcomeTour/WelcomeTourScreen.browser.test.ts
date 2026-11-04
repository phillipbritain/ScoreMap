import { act, createElement, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { firstVisitSettings, type ViewerSettings } from '../settings/viewerSettings'
import { useLeagues } from '../settings/leagues'
import { WelcomeTourScreen } from './WelcomeTourScreen'

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
let root: Root | undefined

afterEach(async () => {
  await act(() => root?.unmount())
  document.body.replaceChildren()
  vi.unstubAllGlobals()
})

const leagues = [{ name: 'NFL', sport: 'Football' }, { name: 'NBA', sport: 'Basketball' }]

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json(leagues)))
})

function pendingResponse() {
  let resolve!: (response: Response) => void
  const promise = new Promise<Response>((complete) => { resolve = complete })
  return { promise, resolve }
}

async function mountTour() {
  const changed = vi.fn<(settings: ViewerSettings) => void>()
  const event = vi.fn()
  function Tour() {
    const leagueList = useLeagues()
    const [settings, setSettings] = useState(firstVisitSettings)
    return createElement(WelcomeTourScreen, {
      progress: 'welcome', leagueList, settings, onEvent: event, onOpenGame: vi.fn(),
      onChange: (next) => { changed(next); setSettings(next) },
    })
  }
  const container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
  await act(() => root!.render(createElement(Tour)))
  return { changed, event }
}

function button(name: string): HTMLButtonElement {
  const found = [...document.querySelectorAll('button')].find((candidate) => candidate.textContent?.trim() === name
    || candidate.querySelector('strong')?.textContent === name)
  expect(found, `button ${name}`).toBeDefined()
  return found!
}

async function click(name: string) {
  await act(() => button(name).click())
}

it('can leave the picker and choose Everything without applying unfinished picks', async () => {
  const { changed, event } = await mountTour()
  await click('My leagues')
  await click('Back')
  expect(changed).not.toHaveBeenCalled()
  await click('Everything')
  expect(changed).toHaveBeenCalledWith(firstVisitSettings)
  expect(event).toHaveBeenCalledWith({ kind: 'chose', choice: 'everything' })
})

it('recovers a failed league list with Retry before applying an explicit pick', async () => {
  vi.stubGlobal('fetch', vi.fn()
    .mockResolvedValueOnce(new Response(null, { status: 503 }))
    .mockResolvedValueOnce(Response.json(leagues)))
  const { changed, event } = await mountTour()
  await click('My leagues')
  expect(document.body.textContent).toContain('Could not load leagues')
  expect(button('Show these').disabled).toBe(true)
  expect(changed).not.toHaveBeenCalled()
  await click('Retry')
  expect(button('Show these').disabled).toBe(true)
  await click('Football')
  expect(button('Show these').disabled).toBe(false)
  await click('Show these')
  expect(changed).toHaveBeenCalledWith({ ...firstVisitSettings, hiddenLeagues: ['NBA'] })
  expect(event).toHaveBeenCalledWith({ kind: 'chose', choice: 'myLeagues' })
})

it('keeps late-loading leagues unpicked and cannot apply the unavailable list', async () => {
  const response = pendingResponse()
  vi.stubGlobal('fetch', vi.fn().mockReturnValue(response.promise))
  const { changed, event } = await mountTour()
  await click('My leagues')
  expect(document.body.textContent).toContain('Loading leagues')
  expect(document.body.textContent).not.toContain('Select all')
  await click('Show these')
  expect(changed).not.toHaveBeenCalled()
  expect(event).not.toHaveBeenCalled()
  await act(async () => { response.resolve(Response.json(leagues)) })
  expect(button('Football').getAttribute('aria-pressed')).toBe('false')
  expect(button('Basketball').getAttribute('aria-pressed')).toBe('false')
  expect(button('Show these').disabled).toBe(true)
})

it.each(['http', 'network', 'invalid JSON'] as const)('can leave a persistent %s failure for Top Events', async (failure) => {
  vi.stubGlobal('fetch', vi.fn().mockImplementation(() => failure === 'network'
    ? Promise.reject(new TypeError('Failed to fetch'))
    : Promise.resolve(failure === 'http' ? new Response(null, { status: 503 }) : new Response('not JSON'))))
  const { changed, event } = await mountTour()
  await click('My leagues')
  await click('Retry')
  expect(document.querySelector('[role="alert"]')?.textContent).toContain('Could not load leagues')
  expect(button('Show these').disabled).toBe(true)
  expect(changed).not.toHaveBeenCalled()
  await click('Back')
  await click('Top Events')
  expect(changed).toHaveBeenCalledWith({ ...firstVisitSettings, topEventsOnly: true })
  expect(event).toHaveBeenCalledWith({ kind: 'chose', choice: 'topEvents' })
})

it('distinguishes a successfully loaded empty list from a failure and can go Back', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json([])))
  await mountTour()
  await click('My leagues')
  expect(document.querySelector('[role="status"]')?.textContent).toContain('No leagues are available')
  expect(document.querySelector('[role="alert"]')).toBeNull()
  expect(button('Show these').disabled).toBe(true)
  await click('Back')
  expect(button('Everything').disabled).toBe(false)
})

it.each([false, true])('aborts an unanswered request on unmount (retry: %s)', async (retrying) => {
  const response = pendingResponse()
  const fetchList = vi.fn<typeof fetch>()
  if (retrying) fetchList.mockResolvedValueOnce(new Response(null, { status: 503 }))
  fetchList.mockReturnValue(response.promise)
  vi.stubGlobal('fetch', fetchList)
  await mountTour()
  if (retrying) {
    await click('My leagues')
    await click('Retry')
  }
  const signal = fetchList.mock.calls.at(-1)?.[1]?.signal
  expect(signal?.aborted).toBe(false)
  await act(() => root!.unmount())
  root = undefined
  expect(signal?.aborted).toBe(true)
  // Even a transport that completes after cancellation cannot revive the unmounted hook.
  await act(async () => { response.resolve(Response.json(leagues)) })
  expect(document.querySelector('[role="dialog"]')).toBeNull()
  expect(fetchList).toHaveBeenCalledTimes(retrying ? 2 : 1)
})
