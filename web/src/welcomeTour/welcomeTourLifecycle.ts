import { useCallback, useEffect, useReducer, useRef } from 'react'
import type { Game, VenuePhoto } from '../games/game'
import type { JustHappened } from '../games/justHappened'
import type { Camera } from '../globe/camera'
import type { SettingsStore } from '../settings/settingsStore'
import type { TourGame } from './tourGame'
import { tourCamera, tourGames, tourGameToTry, type TourScreen } from './tourGames'
import { tourPlayStart, tourPlayTick, type TourPlayState } from './tourPlay'
import { fetchVenuePhotos, withVenuePhotos } from './tourVenuePhotos'
import { tourProgressAfter, type TourEvent, type TourProgress } from './welcomeTour'

const noGames: readonly TourGame[] = []
/** One game has a play every 2 seconds, the open game every other time. */
const playIntervalMs = 2000

interface WelcomeTour {
  progress: TourProgress
  camera: Camera
  board: readonly TourGame[]
  play: TourPlayState
  photos: ReadonlyMap<string, VenuePhoto>
  openGameId: string | null
  detailsOpen: boolean
}

type WelcomeTourEvent = TourEvent
  | { kind: 'again'; now: number; screen: TourScreen }
  | { kind: 'gameClosed' }
  | { kind: 'detailsChanged'; open: boolean }
  | { kind: 'play'; now: number }
  | { kind: 'photosLoaded'; photos: ReadonlyMap<string, VenuePhoto> }

/** Starts with the progress the settings store restored, before the first games or camera are shown. */
export function startWelcomeTour(progress: TourProgress, now: number, screen: TourScreen): WelcomeTour {
  const board = tourGames(now)
  return {
    progress, camera: tourCamera(screen), board,
    play: tourPlayStart(progress === 'welcome' || progress === 'finished' ? noGames : board),
    photos: new Map(), openGameId: null, detailsOpen: false,
  }
}

/** Applies one event from a step, the event panel, or the tour's simulated play and venue photo lookup. */
export function welcomeTourAfter(tour: WelcomeTour, event: WelcomeTourEvent): WelcomeTour {
  switch (event.kind) {
    case 'again': {
      const next = startWelcomeTour('welcome', event.now, event.screen)
      return { ...next, board: withVenuePhotos(next.board, tour.photos), photos: tour.photos }
    }
    case 'gameClosed':
      return tour.openGameId === null ? tour : { ...tour, openGameId: null }
    case 'detailsChanged':
      return tour.openGameId === null || tour.detailsOpen === event.open ? tour : { ...tour, detailsOpen: event.open }
    case 'play':
      return tour.play.games.length === 0 ? tour : { ...tour, play: tourPlayTick(tour.play, tour.openGameId, event.now) }
    case 'photosLoaded': {
      if (!event.photos.size) return tour
      const photos = new Map([...tour.photos, ...event.photos])
      const board = withVenuePhotos(tour.board, event.photos)
      const play = tour.play.games.length
        ? { ...tour.play, games: withVenuePhotos(tour.play.games, event.photos) }
        : tour.play
      return { ...tour, photos, board, play }
    }
  }
  if (event.kind === 'gameOpened' && event.gameId !== tourGameToTry) return tour
  const progress = tourProgressAfter(tour.progress, event)
  if (progress === tour.progress) return tour
  if (progress === 'finished') return { ...tour, progress, openGameId: null, play: tourPlayStart(noGames) }
  if (event.kind === 'chose') return { ...tour, progress, play: tourPlayStart(tour.board) }
  if (event.kind === 'gameOpened') return { ...tour, progress, openGameId: event.gameId }
  return { ...tour, progress }
}

interface RunningGames {
  games: readonly Game[] | null
  justHappened: JustHappened
  detailsOpen: boolean
}

/** What App should show over the running game board. A null game list still means no snapshot. */
export function readWelcomeTour(tour: WelcomeTour, running: RunningGames, revealed: boolean) {
  const active = tour.progress !== 'finished'
  const step = revealed && tour.progress !== 'finished' ? tour.progress : null
  return {
    step,
    railHidden: tour.progress === 'welcome',
    camera: active ? tour.camera : null,
    games: active ? tour.play.games : running.games,
    justHappened: active ? tour.play.changes : running.justHappened,
    detailsOpen: active ? tour.detailsOpen : running.detailsOpen,
    tabsLocked: step === 'eventPanel',
    gameToTry: tourGameToTry,
    openGameId: tour.openGameId,
  }
}

function tourScreen(): TourScreen {
  if (window.matchMedia('(max-width: 640px)').matches) return 'phone'
  return window.matchMedia('(orientation: landscape) and (max-height: 500px)').matches ? 'short' : 'wide'
}

/** The React connection for the lifecycle. The settings store still interprets and saves progress. */
export function useWelcomeTour(
  store: Pick<SettingsStore, 'loadTourProgress' | 'saveTourProgress'>,
  running: RunningGames & { onDetailsOpenChange: (open: boolean) => void },
  revealed: boolean,
) {
  const [tour, send] = useReducer(welcomeTourAfter, store, (store) => startWelcomeTour(store.loadTourProgress(), Date.now(), tourScreen()))
  const { openGameId, ...view } = readWelcomeTour(tour, running, revealed)
  const active = tour.progress !== 'finished'
  useEffect(() => store.saveTourProgress(tour.progress), [store, tour.progress])
  const playing = view.step !== null && tour.play.games.length > 0
  useEffect(() => {
    if (!playing) return
    const timer = window.setInterval(() => send({ kind: 'play', now: performance.now() }), playIntervalMs)
    return () => window.clearInterval(timer)
  }, [playing])

  // Ask once per venue for these same six games, including across Welcome tour again.
  const asked = useRef(false)
  const board = tour.play.games.length ? tour.board : null
  useEffect(() => {
    if (asked.current || !board) return
    asked.current = true
    void fetchVenuePhotos(board).then((photos) => send({ kind: 'photosLoaded', photos }))
  }, [board])

  const onEvent: (event: TourEvent) => void = send
  const onSelectionChange = useCallback((gameId: string | null) => {
    send(gameId === null ? { kind: 'gameClosed' } : { kind: 'gameOpened', gameId })
  }, [])
  return {
    ...view,
    onEvent,
    restart: () => {
      const screen = tourScreen()
      send({ kind: 'again', now: Date.now(), screen })
      return tourCamera(screen)
    },
    onDetailsOpenChange: active
      ? (open: boolean) => send({ kind: 'detailsChanged', open })
      : running.onDetailsOpenChange,
    onDetailsTabOpened: view.step ? () => send({ kind: 'detailsTabOpened' }) : undefined,
    selection: active ? { gameId: openGameId, onChange: onSelectionChange } : undefined,
  }
}
