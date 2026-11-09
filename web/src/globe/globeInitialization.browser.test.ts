import { createElement, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, expect, it, vi } from 'vitest'
import { Map as MapLibreMap, type StyleSpecification } from 'maplibre-gl'
import { noRecentChanges } from '../games/recentChanges'
import { Globe } from './Globe'
import { type LoadingStage } from './globeMap'
import { baseStyleUrl } from './globeStyle'
import { cityLabelSettings } from './cityLabels'
import { unfittedZoom } from './zoomLevels'
import { LoadingScreen } from '../loading/LoadingScreen'
import { builtInTheme } from '../theme/builtInTheme'
import { applyTheme } from '../theme/applyTheme'
import '../index.css'

// The base-style service's smallest valid answer. No remote tiles or fonts are needed at zoom 2.
const baseStyle: StyleSpecification = {
  version: 8,
  sources: { openmaptiles: { type: 'vector', tiles: [] } },
  layers: ['boundary_2', 'boundary_3', 'boundary_disputed'].map((id) => ({
    id, type: 'line', source: 'openmaptiles', 'source-layer': 'boundary',
  })),
}

let root: Root | undefined
let container: HTMLDivElement

function open() {
  applyTheme(document.documentElement, builtInTheme)
  container = document.createElement('div')
  container.style.cssText = 'position: relative; width: 800px; height: 600px'
  document.body.append(container)
  root = createRoot(container)
  root.render(createElement(LoadingGlobe))
}

// Hosts the production components at their public stage/retry seam, as App does.
function LoadingGlobe() {
  const [stage, setStage] = useState<LoadingStage>('waitingForGames')
  const [attempt, setAttempt] = useState(0)
  const [gone, setGone] = useState(false)
  return createElement('div', null,
    createElement(Globe, {
      key: `globe-${attempt}`,
      theme: builtInTheme,
      cityLabels: cityLabelSettings,
      zoomSettings: { ...unfittedZoom, minZoom: 2 },
      colors: { sportColors: {}, leagueColors: {} }, mapType: 'plain', showGameCityReach: false,
      games: [], changes: noRecentChanges, selectedGameId: null,
      panel: { current: null }, onSelectGame: () => {},
      startCamera: { longitude: 0, latitude: 0, zoom: 2 },
      onCameraMove: () => {}, onStage: setStage,
    }),
    !gone && createElement(LoadingScreen, {
      key: `loading-${attempt}`, stage,
      onGone: () => setGone(true),
      onRetry: () => {
        setStage('waitingForGames')
        setAttempt((value) => value + 1)
      },
    }),
  )
}

function styleService(answer: (request: Request) => Promise<Response>) {
  const fetch = globalThis.fetch.bind(globalThis)
  return vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
    const url = input instanceof Request ? input.url : String(input)
    return url === baseStyleUrl ? answer(input instanceof Request ? input : new Request(input, init)) : fetch(input, init)
  })
}

const retry = () => container.querySelector<HTMLButtonElement>('.loading-screen__retry')
const message = () => container.querySelector('[role="alert"]')?.textContent
const ready = () => {
  expect(container.querySelectorAll('canvas.maplibregl-canvas')).toHaveLength(1)
  expect(window.scoremap?.stage()).toBe('ready')
  expect(container.querySelector('.loading-screen')).toBeNull()
}

async function waitForError(text: string) {
  await vi.waitFor(() => expect(message()).toContain(text))
  expect(retry()?.textContent).toBe('Try again')
}

afterEach(() => {
  root?.unmount()
  root = undefined
  container?.remove()
  vi.restoreAllMocks()
})

it.each(['HTTP error', 'network rejection', 'invalid style'])(
  'retries a failed initial style (%s) and reaches ready without a page reload',
  async (failure) => {
    let recovered = false
    styleService(async () => {
      if (recovered) return Response.json(baseStyle)
      if (failure === 'network rejection') throw new TypeError('Failed to fetch')
      return failure === 'invalid style' ? Response.json({ version: 8, sources: {}, layers: [] }) : new Response('', { status: 503 })
    })
    const remove = vi.spyOn(MapLibreMap.prototype, 'remove')
    open()
    await waitForError('The map couldn’t load')
    const failedMap = window.scoremap!.map
    expect(remove).toHaveBeenCalledOnce()
    const context = failedMap.getCanvas().getContext('webgl2')
    expect(context?.isContextLost()).toBe(true)
    recovered = true
    retry()!.click()
    await vi.waitFor(ready, { timeout: 15_000 })
    expect(remove).toHaveBeenCalledOnce()
    expect(window.scoremap!.map).not.toBe(failedMap)
    expect(container.querySelectorAll('canvas.maplibregl-canvas')).toHaveLength(1)
    expect(window.scoremap!.stage()).toBe('ready')
  },
)

it('explains WebGL failure and can start once WebGL becomes available', async () => {
  const getContext = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
  styleService(async () => Response.json(baseStyle))
  open()
  await waitForError('Check that WebGL is enabled')
  expect(container.querySelector('canvas.maplibregl-canvas')).toBeNull()
  getContext.mockRestore()
  retry()!.click()
  await vi.waitFor(ready, { timeout: 15_000 })
  expect(container.querySelectorAll('canvas.maplibregl-canvas')).toHaveLength(1)
})

it('cleans up a partial map when initialization throws after map construction', async () => {
  styleService(async () => Response.json(baseStyle))
  const remove = vi.spyOn(MapLibreMap.prototype, 'remove')
  const setStyle = vi.spyOn(MapLibreMap.prototype, 'setStyle').mockImplementationOnce(() => {
    throw new Error('Style setup failed')
  })
  open()
  await waitForError('The globe couldn’t start')
  expect(remove).toHaveBeenCalledOnce()
  setStyle.mockRestore()
  retry()!.click()
  await vi.waitFor(ready, { timeout: 15_000 })
  root!.unmount()
  root = undefined
  expect(remove).toHaveBeenCalledTimes(2)
})

it('keeps a usable globe ready after an individual tile error', async () => {
  styleService(async () => Response.json(baseStyle))
  open()
  await vi.waitFor(ready, { timeout: 15_000 })
  // MapLibre forwards source/tile errors through this documented event boundary.
  window.scoremap!.map.fire('error', { error: new Error('Tile unavailable'), sourceId: 'openmaptiles', tile: {} })
  expect(window.scoremap!.stage()).toBe('ready')
  ready()
  expect(retry()).toBeNull()
})

it('aborts a pending initial style request on unmount and can initialize on the next mount', async () => {
  let pending: Request | undefined
  let recovered = false
  styleService((request) => {
    if (recovered) return Promise.resolve(Response.json(baseStyle))
    pending = request
    return new Promise<Response>((_, reject) => {
      request.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true })
    })
  })
  open()
  await vi.waitFor(() => expect(pending).toBeDefined())
  root!.unmount()
  root = undefined
  expect(pending!.signal.aborted).toBe(true)
  expect(container.querySelector('canvas.maplibregl-canvas')).toBeNull()
  recovered = true
  root = createRoot(container)
  root.render(createElement(LoadingGlobe))
  await vi.waitFor(ready, { timeout: 10_000 })
})

it('cleans up each failed retry before creating the next globe', async () => {
  const addListener = vi.spyOn(window, 'addEventListener')
  const removeListener = vi.spyOn(window, 'removeEventListener')
  let recovered = false
  styleService(async () => recovered ? Response.json(baseStyle) : new Response('', { status: 503 }))
  const remove = vi.spyOn(MapLibreMap.prototype, 'remove')
  open()
  await waitForError('The map couldn’t load')
  expect(remove).toHaveBeenCalledTimes(1)
  retry()!.click()
  await vi.waitFor(() => expect(remove).toHaveBeenCalledTimes(2))
  await waitForError('The map couldn’t load')
  recovered = true
  retry()!.click()
  await vi.waitFor(ready, { timeout: 10_000 })
  root!.unmount()
  root = undefined
  expect(remove).toHaveBeenCalledTimes(3)
  const added = addListener.mock.calls.filter(([type]) => type === 'pagehide')
  const removed = removeListener.mock.calls.filter(([type]) => type === 'pagehide')
  expect(added).toHaveLength(3)
  expect(removed).toHaveLength(3)
  for (const [, listener] of added) expect(removed.some(([, cleared]) => cleared === listener)).toBe(true)
})
