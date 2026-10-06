import { Map as MapLibreMap, setWorkerUrl, type ExpressionSpecification, type GeoJSONSource } from 'maplibre-gl'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
import 'maplibre-gl/dist/maplibre-gl.css'
import type { Feature, Point } from 'geojson'
import { useEffect, useImperativeHandle, useRef, type Ref } from 'react'
import type { Game } from '../games/game'
import type { GameChange } from '../games/gameChange'
import { animationTarget } from './animationTarget'
import type { Camera } from './camera'
import { pinAnimation, type PinAnimation } from './pinAnimation'
import { pinFeatures } from './pinFeatures'
import { pulse } from './pinPulse'
import {
  cardFootprint,
  cardFootprintLayerSpec,
  pinFootprint,
  pinFootprintLayerSpec,
  clusterLayer,
  clusterLayers,
  pinSource,
  pinSourceSpec,
  smallPinLayer,
  smallPinLayerSpec,
} from './pinLayers'
import { addGlobeGlow } from './globeGlow'
import { baseStyleUrl, firstPlaceNameLayer, globeStyle } from './globeStyle'
import { ScoreCardMarkers } from './scoreCardMarkers'
import { shouldSpin, spunLongitude } from './slowSpin'
import { cardZoom, clusterMaxZoom, pinLayout } from './zoomLevels'

// MapLibre's default worker path doesn't survive Vite's bundling.
setWorkerUrl(workerUrl)

const selectedPinLayer = 'pin-selected'
// Marks the camera moves slow spin makes, to tell them apart from the viewer's own.
const spinMove = { slowSpin: true }
// After a long gap between frames (a hidden tab), spin on from where it was rather than jump.
const maxSpinFrameMs = 100

/** What the app can ask of the globe beyond drawing its games. */
export interface GlobeHandle {
  /** Animates a changed game's pin, or its cluster, if the change is one worth noticing. */
  showChange: (change: GameChange) => void
}

interface GlobeProps {
  ref?: Ref<GlobeHandle>
  games: readonly Game[]
  /** The game whose panel is open: its pin is highlighted and the globe turns to centre it. */
  selectedGameId: string | null
  onSelectGame: (gameId: string) => void
  /** Where the globe opens. Only read when the globe is created. */
  startCamera: Camera
  /** Called when the camera settles somewhere new, so it can be saved for the next visit. */
  onCameraMove: (camera: Camera) => void
  /** The "Slow spin" setting. */
  slowSpin: boolean
}

/** Matches only the selected game's small pin (nothing when no game is selected, or while it's in a cluster). */
function selectedPin(gameId: string | null): ExpressionSpecification {
  return ['all', ['!', ['has', 'point_count']], ['==', ['get', 'gameId'], gameId ?? '']]
}

/**
 * MapLibre globe with a pin at each game's venue. Zoomed out, pins are small and nearby ones form
 * clusters with counts; zoomed in, each pin becomes a score card. Selecting a cluster zooms in until it splits.
 */
export function Globe({ ref, games, selectedGameId, onSelectGame, startCamera, onCameraMove, slowSpin }: GlobeProps) {
  const container = useRef<HTMLDivElement>(null)
  const map = useRef<MapLibreMap | null>(null)
  const cards = useRef<ScoreCardMarkers | null>(null)
  const latestGames = useRef(games)
  const latestSelected = useRef(selectedGameId)
  const latestOnSelect = useRef(onSelectGame)
  const latestStartCamera = useRef(startCamera)
  const latestOnCameraMove = useRef(onCameraMove)
  const latestSlowSpin = useRef(slowSpin)
  const pendingAnimations = useRef<{ game: Game; animation: PinAnimation }[]>([])

  useImperativeHandle(
    ref,
    () => ({
      // Played once the changed games reach the globe (see below), so it's known whether the game still shows.
      showChange: (change) => {
        const animation = pinAnimation(change)
        if (animation) pendingAnimations.current.push({ game: change.game, animation })
      },
    }),
    [],
  )

  useEffect(() => {
    latestOnSelect.current = onSelectGame
    latestOnCameraMove.current = onCameraMove
    latestSlowSpin.current = slowSpin
  }, [onSelectGame, onCameraMove, slowSpin])

  useEffect(() => {
    if (!container.current) return
    const instance = new MapLibreMap({
      container: container.current,
      center: [latestStartCamera.current.longitude, latestStartCamera.current.latitude],
      zoom: latestStartCamera.current.zoom,
    })
    instance.setStyle(baseStyleUrl, { transformStyle: (_previous, base) => globeStyle(base) })
    const removeGlow = addGlobeGlow(instance)
    const scoreCards = new ScoreCardMarkers(instance, (gameId) => latestOnSelect.current(gameId))
    scoreCards.setGames(latestGames.current)
    scoreCards.setSelected(latestSelected.current)
    let clusterRadius = pinLayout(instance.getZoom()).clusterRadius

    instance.on('style.load', () => {
      instance.setProjection({ type: 'globe' })
      clusterRadius = pinLayout(instance.getZoom()).clusterRadius
      instance.addSource(pinSource, pinSourceSpec(pinFeatures(latestGames.current), instance.getZoom()))
      // Beneath the place names, so a pin never hides a city's name.
      const belowNames = firstPlaceNameLayer(instance.getStyle())
      for (const layer of clusterLayers) instance.addLayer(layer, belowNames)
      instance.addLayer(smallPinLayerSpec, belowNames)
      // A ring around the selected game's small pin; zoomed in, its score card is highlighted instead.
      instance.addLayer(
        {
          id: selectedPinLayer,
          type: 'circle',
          source: pinSource,
          filter: selectedPin(latestSelected.current),
          maxzoom: cardZoom,
          paint: {
            'circle-radius': 13,
            'circle-color': 'rgba(0, 0, 0, 0)',
            'circle-stroke-width': 3,
            'circle-stroke-color': '#2f80ed',
          },
        },
        belowNames,
      )
      // On top, so names are placed around the pins' footprints rather than under the pins.
      addBlankImage(instance, cardFootprint.image, cardFootprint.width, cardFootprint.height)
      addBlankImage(instance, pinFootprint.image, pinFootprint.size, pinFootprint.size)
      instance.addLayer(cardFootprintLayerSpec)
      instance.addLayer(pinFootprintLayerSpec)
    })

    // The cluster radius changes with zoom: wider for score cards than small pins, and in steps
    // between whole zoom levels (see pinLayout).
    instance.on('zoom', () => {
      const wanted = pinLayout(instance.getZoom()).clusterRadius
      if (wanted === clusterRadius) return
      clusterRadius = wanted
      void instance
        .getSource<GeoJSONSource>(pinSource)
        ?.setClusterOptions({ cluster: true, clusterRadius, clusterMaxZoom })
    })

    // Cards follow the clustered source, which changes as the camera moves and data arrives.
    instance.on('render', () => scoreCards.sync())

    instance.on('click', clusterLayer, async (event) => {
      const cluster = event.features?.[0]
      const source = instance.getSource<GeoJSONSource>(pinSource)
      if (!cluster || !source) return
      const zoom = await source.getClusterExpansionZoom(cluster.properties.cluster_id)
      instance.easeTo({ center: (cluster.geometry as Point).coordinates as [number, number], zoom })
    })
    instance.on('click', smallPinLayer, (event) => {
      const gameId: unknown = event.features?.[0]?.properties?.gameId
      if (typeof gameId === 'string') latestOnSelect.current(gameId)
    })
    for (const layer of [clusterLayer, smallPinLayer]) {
      instance.on('mouseenter', layer, () => (instance.getCanvas().style.cursor = 'pointer'))
      instance.on('mouseleave', layer, () => (instance.getCanvas().style.cursor = ''))
    }

    // Remember where the viewer leaves the globe. Spin moves aren't saved one by one (that would
    // write to storage every frame); the camera is saved when spin stops and when the page closes.
    const saveCamera = () => {
      const { lng, lat } = instance.getCenter().wrap()
      latestOnCameraMove.current({ longitude: lng, latitude: lat, zoom: instance.getZoom() })
    }
    window.addEventListener('pagehide', saveCamera)

    // The viewer is interacting while holding the globe, and while any move that isn't slow spin
    // runs: their drag, zoom or its glide afterwards, or a turn to a cluster they selected.
    let holding = false
    let moving = false
    instance.on('movestart', (event) => {
      if (!('slowSpin' in event)) moving = true
    })
    instance.on('moveend', (event) => {
      if ('slowSpin' in event) return
      moving = false
      saveCamera()
    })
    const hold = () => (holding = true)
    const release = () => (holding = false)
    instance.on('mousedown', hold)
    instance.on('touchstart', hold)
    window.addEventListener('mouseup', release)
    window.addEventListener('touchend', release)
    window.addEventListener('touchcancel', release)

    let spinning = false
    let lastFrame: number | null = null
    let frame = requestAnimationFrame(function spin(now) {
      const elapsed = Math.min(now - (lastFrame ?? now), maxSpinFrameMs)
      lastFrame = now
      const spinNow = shouldSpin({
        slowSpin: latestSlowSpin.current,
        gameSelected: latestSelected.current !== null,
        interacting: holding || moving,
      })
      if (spinNow) {
        const { lng, lat } = instance.getCenter()
        instance.jumpTo({ center: [spunLongitude(lng, elapsed), lat] }, spinMove)
      } else if (spinning) {
        saveCamera()
      }
      spinning = spinNow
      frame = requestAnimationFrame(spin)
    })

    map.current = instance
    cards.current = scoreCards
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('pagehide', saveCamera)
      window.removeEventListener('mouseup', release)
      window.removeEventListener('touchend', release)
      window.removeEventListener('touchcancel', release)
      scoreCards.clear()
      removeGlow()
      instance.remove()
      map.current = null
      cards.current = null
    }
  }, [])

  useEffect(() => {
    latestGames.current = games
    map.current?.getSource<GeoJSONSource>(pinSource)?.setData(pinFeatures(games))
    cards.current?.setGames(games)

    // Games the globe doesn't show (hidden by the viewer's filters) don't animate.
    const pending = pendingAnimations.current
    pendingAnimations.current = []
    const instance = map.current
    const scoreCards = cards.current
    if (!instance || !scoreCards) return
    for (const { game, animation } of pending) {
      if (games.some((g) => g.id === game.id)) void animateGame(instance, scoreCards, game, animation)
    }
  }, [games])

  // Only when the selection changes: later snapshots must not pull the camera back.
  useEffect(() => {
    latestSelected.current = selectedGameId
    cards.current?.setSelected(selectedGameId)
    const instance = map.current
    if (!instance) return
    if (instance.getLayer(selectedPinLayer)) instance.setFilter(selectedPinLayer, selectedPin(selectedGameId))
    const game = latestGames.current.find((g) => g.id === selectedGameId)
    if (game) instance.easeTo({ center: [game.venue.longitude, game.venue.latitude], duration: 1200 })
  }, [selectedGameId])

  return <div ref={container} className="globe" />
}

/** A fully transparent image, for the pins' invisible footprints. */
function addBlankImage(map: MapLibreMap, name: string, width: number, height: number): void {
  map.addImage(name, { width, height, data: new Uint8Array(width * height * 4) })
}

/**
 * Plays an animation where a game shows on the globe: its score card when zoomed in, its small pin
 * when zoomed out, or the cluster it's in. Games not on the map (off screen, or not shown at all) don't animate.
 */
async function animateGame(map: MapLibreMap, cards: ScoreCardMarkers, game: Game, animation: PinAnimation): Promise<void> {
  const source = map.getSource<GeoJSONSource>(pinSource)
  if (!source || !map.isSourceLoaded(pinSource)) return
  const venue: [number, number] = [game.venue.longitude, game.venue.latitude]
  const target = animationTarget(game.id, venue, map.querySourceFeatures(pinSource) as Feature<Point>[])
  if (!target) return

  if (target.kind === 'pin') {
    if (pinLayout(map.getZoom()).size === 'card') cards.animate(game.id, animation)
    else pulse(map, target.lngLat, animation, 'pin')
    return
  }

  for (const { clusterId, lngLat } of target.candidates) {
    // A cluster can be gone by the time it's asked (the data or zoom changed), so skip it.
    const leaves = await source.getClusterLeaves(clusterId, Infinity, 0).catch(() => [])
    if (leaves.some((leaf) => leaf.properties?.gameId === game.id)) {
      pulse(map, lngLat, animation, 'cluster')
      return
    }
  }
}
