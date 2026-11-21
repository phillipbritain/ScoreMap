import { act, createElement, useReducer, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { userEvent } from 'vitest/browser'
import { EventPanel } from '../panel/EventPanel'
import { firstVisitSettings, type ViewerSettings } from '../settings/viewerSettings'
import { useLeagues } from '../settings/leagues'
import { WelcomeTourScreen } from './WelcomeTourScreen'
import { noneJustHappened } from '../games/justHappened'
import type { TourProgress } from './welcomeTour'
import { readWelcomeTour, startWelcomeTour, welcomeTourAfter } from './welcomeTourLifecycle'

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
let root: Root | undefined

afterEach(async () => {
  await act(() => root?.unmount())
  document.body.replaceChildren()
  vi.unstubAllGlobals()
})

const leagues = [
  { name: 'NFL', sport: 'Football', conferences: [] },
  { name: 'NCAA Football', sport: 'Football', conferences: ['SEC', 'ACC'] },
  { name: 'NBA', sport: 'Basketball', conferences: [] },
]

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json(leagues)))
})

function pendingResponse() {
  let resolve!: (response: Response) => void
  const promise = new Promise<Response>((complete) => { resolve = complete })
  return { promise, resolve }
}

async function mountTour(progress: Exclude<TourProgress, 'finished'> = 'welcome') {
  const changed = vi.fn<(settings: ViewerSettings) => void>()
  const event = vi.fn()
  function Tour() {
    const leagueList = useLeagues()
    const [settings, setSettings] = useState(firstVisitSettings)
    return createElement(WelcomeTourScreen, {
      progress, leagueList, settings, onEvent: event, scoreCards: () => [], gameToTry: 'A',
      onChange: (next) => { changed(next); setSettings(next) },
    })
  }
  const container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
  await act(() => root!.render(createElement(Tour)))
  return { changed, event }
}

/** A button by its text, its name on Welcome's choices, or its accessible label (a league's conferences toggle). */
function button(name: string): HTMLButtonElement {
  const found = [...document.querySelectorAll('button')].find((candidate) => candidate.textContent?.trim() === name
    || candidate.querySelector('strong')?.textContent === name
    || candidate.getAttribute('aria-label') === name)
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

it("chooses a league's conferences, as Leagues on the rail does, and applies them only with Show these", async () => {
  const { changed, event } = await mountTour()
  await click('My leagues')
  await click('NCAA Football')
  await click('NCAA Football conferences: all')
  expect(document.querySelector('[role="group"][aria-label="NCAA Football conferences"]')).not.toBeNull()
  await click('SEC')
  expect(button('NCAA Football conferences: SEC').getAttribute('aria-expanded')).toBe('true')
  expect(changed).not.toHaveBeenCalled()
  await click('Show these')
  expect(changed).toHaveBeenCalledWith({
    ...firstVisitSettings,
    hiddenLeagues: ['NFL', 'NBA'],
    chosenConferences: { 'NCAA Football': ['SEC'] },
  })
  expect(event).toHaveBeenCalledWith({ kind: 'chose', choice: 'myLeagues' })
})

it('leaves conferences chosen in the picker unapplied on Back, and starts afresh on My leagues again', async () => {
  const { changed } = await mountTour()
  await click('My leagues')
  await click('NCAA Football conferences: all')
  await click('ACC')
  await click('Back')
  await click('My leagues')
  expect(button('NCAA Football conferences: all').getAttribute('aria-expanded')).toBe('false')
  expect(changed).not.toHaveBeenCalled()
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
  expect(button('Show these').getAttribute('aria-disabled')).toBe('true')
  await click('NFL')
  expect(button('Show these').getAttribute('aria-disabled')).toBeNull()
  await click('Show these')
  expect(changed).toHaveBeenCalledWith({ ...firstVisitSettings, hiddenLeagues: ['NCAA Football', 'NBA'] })
  expect(event).toHaveBeenCalledWith({ kind: 'chose', choice: 'myLeagues' })
})

it('keeps late-loading leagues unpicked and cannot apply the unavailable list', async () => {
  const response = pendingResponse()
  vi.stubGlobal('fetch', vi.fn().mockReturnValue(response.promise))
  const { changed, event } = await mountTour()
  await click('My leagues')
  expect(document.body.textContent).toContain('Loading leagues')
  expect(document.body.textContent).not.toContain('All leagues')
  await click('Show these')
  expect(changed).not.toHaveBeenCalled()
  expect(event).not.toHaveBeenCalled()
  await act(async () => { response.resolve(Response.json(leagues)) })
  for (const { name } of leagues) expect(button(name).getAttribute('aria-pressed')).toBe('false')
  expect(button('Show these').getAttribute('aria-disabled')).toBe('true')
})

it('says why Show these can\'t go on with nothing picked, until a league is picked', async () => {
  const { changed, event } = await mountTour()
  await click('My leagues')
  expect(document.querySelector('.welcome-tour__nothing-picked')).toBeNull()
  await click('Show these')
  expect(document.querySelector('.welcome-tour__nothing-picked[role="status"]')?.textContent).toContain('Pick at least one league')
  expect(changed).not.toHaveBeenCalled()
  expect(event).not.toHaveBeenCalled()
  await click('NBA')
  expect(document.querySelector('.welcome-tour__nothing-picked')).toBeNull()
  await click('Show these')
  expect(event).toHaveBeenCalledWith({ kind: 'chose', choice: 'myLeagues' })
})

it('lets the note on nothing picked fade away by itself', async () => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
  try {
    await mountTour()
    await click('My leagues')
    await click('Show these')
    expect(document.querySelector('.welcome-tour__nothing-picked')).not.toBeNull()
    await act(() => vi.advanceTimersByTime(4000))
    expect(document.querySelector('.welcome-tour__nothing-picked')).toBeNull()
  } finally {
    vi.useRealTimers()
  }
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

it.each(['welcome', 'controls', 'scoreCard', 'eventPanel', 'panelTabs', 'panelWatch'] as const)("closes from %s by the panel's ×", async (progress) => {
  const { changed, event } = await mountTour(progress)
  const close = document.querySelector<HTMLButtonElement>('[aria-label="Close welcome tour"]')
  expect(close?.closest('[role="dialog"]')).not.toBeNull()
  await act(() => close!.click())
  expect(event).toHaveBeenCalledExactlyOnceWith({ kind: 'closed' })
  expect(changed).not.toHaveBeenCalled()
})

it.each(['welcome', 'controls', 'scoreCard', 'eventPanel', 'panelTabs', 'panelWatch'] as const)('closes from %s by Escape, wherever focus is', async (progress) => {
  const { changed, event } = await mountTour(progress)
  await act(() => document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })))
  expect(event).toHaveBeenCalledExactlyOnceWith({ kind: 'closed' })
  expect(changed).not.toHaveBeenCalled()
})

it('closes from Welcome by Skip tour, as the × does', async () => {
  const { changed, event } = await mountTour()
  await click('Skip tour')
  expect(event).toHaveBeenCalledExactlyOnceWith({ kind: 'closed' })
  expect(changed).not.toHaveBeenCalled()
})

it("closes from My leagues' picker by Skip tour without applying its picks", async () => {
  const { changed, event } = await mountTour()
  await click('My leagues')
  await click('NBA')
  await click('Skip tour')
  expect(event).toHaveBeenCalledExactlyOnceWith({ kind: 'closed' })
  expect(changed).not.toHaveBeenCalled()
})

it.each(['controls', 'scoreCard', 'eventPanel', 'panelTabs', 'panelWatch', 'allSet'] as const)('has no Skip tour on %s, past Welcome', async (progress) => {
  await mountTour(progress)
  expect([...document.querySelectorAll('button')].map((found) => found.textContent?.trim())).not.toContain('Skip tour')
})

it("closes from My leagues' picker by Escape without applying its picks", async () => {
  const { changed, event } = await mountTour()
  await click('My leagues')
  await click('NCAA Football')
  await click('NCAA Football conferences: all')
  await click('SEC')
  await act(() => document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })))
  expect(event).toHaveBeenCalledExactlyOnceWith({ kind: 'closed' })
  expect(changed).not.toHaveBeenCalled()
})

it.each([
  ['eventPanel', 'No need to refresh'],
  ['panelTabs', 'Open a tab'],
  ['panelWatch', 'TV button'],
] as const)('moves on from the event panel step %s by Next, saying what it lights', async (progress, words) => {
  const { event } = await mountTour(progress)
  expect(document.querySelector('[role="dialog"]')?.textContent).toContain(words)
  await click('Next')
  expect(event).toHaveBeenCalledExactlyOnceWith({ kind: 'next' })
})

it("leaves Escape to the rail's popovers, usable during the tour, whichever hears it first", async () => {
  const { event } = await mountTour('controls')
  const taken = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
  taken.preventDefault()
  await act(() => document.body.dispatchEvent(taken))
  const popover = document.createElement('div')
  popover.id = 'rail-popover'
  document.body.append(popover)
  await act(() => document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })))
  expect(event).not.toHaveBeenCalled()
  popover.remove()
  await act(() => document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })))
  expect(event).toHaveBeenCalledExactlyOnceWith({ kind: 'closed' })
})

it.each(['click', 'Enter', 'Space'] as const)('moves from Game details to Where to watch when an event panel tab opens with %s', async (activation) => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 503 })))
  const running = { games: null, justHappened: noneJustHappened, detailsOpen: false }
  const tour = startWelcomeTour('scoreCard', Date.now(), 'wide')
  const { gameToTry } = readWelcomeTour(tour, running, true)
  const opened = welcomeTourAfter(tour, { kind: 'gameOpened', gameId: gameToTry })
  const atTabs = welcomeTourAfter(opened, { kind: 'next' })
  function TourWithEventPanel() {
    const [state, send] = useReducer(welcomeTourAfter, atTabs)
    const { step, games, openGameId, detailsOpen, tabsLocked } = readWelcomeTour(state, running, true)
    const game = games?.find(({ id }) => id === openGameId)
    return createElement('div', null,
      game && createElement(EventPanel, {
        game, color: '#d4ac63', textOnColor: '#000e28', venuePhotos: false, detailsOpen, tabsLocked,
        onDetailsOpenChange: (open) => send({ kind: 'detailsChanged', open }), onClose: () => send({ kind: 'gameClosed' }),
        onDetailsTabOpened: () => send({ kind: 'detailsTabOpened' }),
      }),
      step && createElement(WelcomeTourScreen, {
        progress: step, onEvent: send, leagueList: { status: 'ready', leagues, retry: () => {} },
        settings: firstVisitSettings, onChange: () => {},
        scoreCards: () => [], gameToTry,
      }),
    )
  }
  const container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
  await act(() => root!.render(createElement(TourWithEventPanel)))

  const heading = () => container.querySelector('[role="dialog"] h3')?.textContent
  const scoring = button('Scoring')
  expect(heading()).toBe('Game details')
  expect(scoring.getAttribute('aria-selected')).toBe('false')

  if (activation === 'click') {
    await act(() => userEvent.click(scoring))
  } else {
    button('Score').focus()
    await act(() => userEvent.keyboard('{ArrowRight}'))
    expect(document.activeElement).toBe(scoring)
    expect(heading()).toBe('Game details')
    await act(() => userEvent.keyboard(activation === 'Enter' ? '{Enter}' : ' '))
  }

  expect(scoring.getAttribute('aria-selected')).toBe('true')
  expect(heading()).toBe('Where to watch')
  await click('Stats')
  expect(heading()).toBe('Where to watch')
})
