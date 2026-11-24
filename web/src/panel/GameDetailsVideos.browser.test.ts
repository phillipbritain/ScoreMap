import { act, createElement } from 'react'
import { flushSync } from 'react-dom'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, expect, it, vi } from 'vitest'
import { tourGames } from '../welcomeTour/tourGames'
import type { GameDetails, GameVideo } from './gameDetails'
import { GameDetailsPanel } from './GameDetailsPanel'

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })

let root: Root | undefined

afterEach(async () => {
  await act(() => root?.unmount())
  root = undefined
  document.body.replaceChildren()
})

const details = {
  periodScores: [], homeTotal: null, awayTotal: null, scoring: [], drives: [], stats: [], broadcasts: [],
}

const earlier: GameVideo = {
  title: 'Earlier ESPN highlight', url: 'https://www.espn.com/video/clip/_/id/13', duration: 16,
  publishedAt: '2026-11-21T20:02:00Z',
}
const later: GameVideo = {
  title: 'Newer ESPN highlight', url: 'https://www.espn.com/video/clip/_/id/14', duration: 17,
  publishedAt: '2026-11-21T20:04:00Z',
}

async function showVideos(videos: GameVideo[]) {
  const container = document.createElement('div')
  container.className = 'event-panel'
  document.body.append(container)
  const mounted = createRoot(container)
  root = mounted
  const game = { ...tourGames(Date.now())[0], id: '401001234', league: 'NFL' }
  const render = (next: GameVideo[]) => act(() => mounted.render(
    createElement(GameDetailsPanel, { game, details: { ...details, videos: next } satisfies GameDetails,
      failed: false, open: true, onToggle: () => {} }),
  ))
  await render(videos)
  const tab = [...container.querySelectorAll('button')].find((button) => button.textContent === 'Videos')!
  await act(() => tab.click())
  const panel = container.querySelector('[role=tabpanel]')!
  return { panel, render, links: () => [...panel.querySelectorAll('a')].map((link) => link.getAttribute('href')) }
}

it('shows ESPN clips newest first without a source selector and adds newly published clips at the top', async () => {
  const undated = { ...earlier, url: 'https://www.espn.com/video/clip/_/id/12', publishedAt: null }
  const { panel, render, links } = await showVideos([earlier, undated])
  expect(panel.querySelector('[role=group]')).toBeNull()
  expect(links()).toEqual([earlier.url, undated.url])
  await render([earlier, undated, later])
  expect(links()).toEqual([later.url, earlier.url, undated.url])
})

it('uses the floating player for direct ESPN media and retains the original page link if it fails', async () => {
  const clip: GameVideo = { ...later, playback: { kind: 'mp4', url: 'data:video/mp4,' } }
  const { panel, links } = await showVideos([clip])
  expect(panel.querySelector('video')).toBeNull()

  await act(() => {
    const play = panel.querySelector<HTMLButtonElement>(`button[aria-label="Play ${clip.title}"]`)!
    flushSync(() => play.click())
    const player = panel.querySelector('dialog[open]')!
    expect(player).not.toBeNull()
    expect(player.querySelector('[aria-label="Loading video"]')).not.toBeNull()
    const media = player.querySelector('video')!
    expect(media.getAttribute('src')).toBe(clip.playback?.url)
    expect(media.playsInline).toBe(true)
    media.dispatchEvent(new Event('error'))
  })

  await vi.waitFor(() => expect(panel.textContent).toContain('Video unavailable.'))
  expect(panel.querySelector('dialog[open]')).toBeNull()
  expect(links()).toEqual([clip.url])
})
