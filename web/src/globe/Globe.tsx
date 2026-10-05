import { Map as MapLibreMap, setWorkerUrl, type ExpressionSpecification, type GeoJSONSource } from 'maplibre-gl'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
import 'maplibre-gl/dist/maplibre-gl.css'
import type { Feature, Point } from 'geojson'
import { useEffect, useImperativeHandle, useRef, type Ref } from 'react'
import type { Game } from '../games/game'
import type { GameChange } from '../games/gameChange'
import { animationTarget } from './animationTarget'
import { pinAnimation, type PinAnimation } from './pinAnimation'
import { pinFeatures } from './pinFeatures'
import { pulse } from './pinPulse'
import { clusterLayer, clusterLayers, pinSource, pinSourceSpec, smallPinLayer, smallPinLayerSpec } from './pinLayers'
import { ScoreCardMarkers } from './scoreCardMarkers'
import { cardZoom, clusterMaxZoom, pinLayout } from './zoomLevels'

// MapLibre's default worker path doesn't survive Vite's bundling.
setWorkerUrl(workerUrl)

// Free vector tiles with borders and place labels (ADR-0004).
const mapStyle = 'https://tiles.openfreemap.org/styles/liberty'
const selectedPinLayer = 'pin-selected'

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
}

/** Matches only the selected game's small pin (nothing when no game is selected, or while it's in a cluster). */
function selectedPin(gameId: string | null): ExpressionSpecification {
  return ['all', ['!', ['has', 'point_count']], ['==', ['get', 'gameId'], gameId ?? '']]
}

/**
 * MapLibre globe with a pin at each game's venue. Zoomed out, pins are small and nearby ones form
 * clusters with counts; zoomed in, each pin becomes a score card. Selecting a cluster zooms in until it splits.
 */
export function Globe({ ref, games, selectedGameId, onSelectGame }: GlobeProps) {
  const container = useRef<HTMLDivElement>(null)
  const map = useRef<MapLibreMap | null>(null)
  const cards = useRef<ScoreCardMarkers | null>(null)
  const latestGames = useRef(games)
  const latestSelected = useRef(selectedGameId)
  const latestOnSelect = useRef(onSelectGame)

  useImperativeHandle(
    ref,
    () => ({
      showChange: (change) => {
        const animation = pinAnimation(change)
        if (animation && map.current && cards.current) void animateGame(map.current, cards.current, change.game, animation)
      },
    }),
    [],
  )

  useEffect(() => {
    latestOnSelect.current = onSelectGame
  }, [onSelectGame])

  useEffect(() => {
    if (!container.current) return
    const instance = new MapLibreMap({
      container: container.current,
      style: mapStyle,
      center: [-40, 30],
      zoom: 1.5,
    })
    const scoreCards = new ScoreCardMarkers(instance, (gameId) => latestOnSelect.current(gameId))
    scoreCards.setGames(latestGames.current)
    scoreCards.setSelected(latestSelected.current)
    let clusterRadius = pinLayout(instance.getZoom()).clusterRadius

    instance.on('style.load', () => {
      instance.setProjection({ type: 'globe' })
      clusterRadius = pinLayout(instance.getZoom()).clusterRadius
      instance.addSource(pinSource, pinSourceSpec(pinFeatures(latestGames.current), instance.getZoom()))
      for (const layer of clusterLayers) instance.addLayer(layer)
      instance.addLayer(smallPinLayerSpec)
      // A ring around the selected game's small pin; zoomed in, its score card is highlighted instead.
      instance.addLayer({
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
      })
    })

    // Score cards need more room than small pins, so they cluster over a wider radius.
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

    map.current = instance
    cards.current = scoreCards
    return () => {
      scoreCards.clear()
      instance.remove()
      map.current = null
      cards.current = null
    }
  }, [])

  useEffect(() => {
    latestGames.current = games
    map.current?.getSource<GeoJSONSource>(pinSource)?.setData(pinFeatures(games))
    cards.current?.setGames(games)
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
