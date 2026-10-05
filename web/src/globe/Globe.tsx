import { Map as MapLibreMap, type ExpressionSpecification, type GeoJSONSource } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { useEffect, useRef } from 'react'
import type { Game } from '../games/game'
import { pinFeatures } from './pinFeatures'

// Free vector tiles with borders and place labels (ADR-0004).
const mapStyle = 'https://tiles.openfreemap.org/styles/liberty'
const pinSource = 'pins'
const pinLayer = 'pins'
const selectedPinLayer = 'pin-selected'

interface GlobeProps {
  games: readonly Game[]
  /** The game whose panel is open: its pin is highlighted and the globe turns to centre it. */
  selectedGameId: string | null
  onSelectGame: (gameId: string) => void
}

/** Matches only the selected game's pin (nothing when no game is selected). */
function selectedPin(gameId: string | null): ExpressionSpecification {
  return ['==', ['get', 'gameId'], gameId ?? '']
}

/** MapLibre globe with a pin at each game's venue. */
export function Globe({ games, selectedGameId, onSelectGame }: GlobeProps) {
  const container = useRef<HTMLDivElement>(null)
  const map = useRef<MapLibreMap | null>(null)
  const latestGames = useRef(games)
  const latestSelected = useRef(selectedGameId)
  const latestOnSelect = useRef(onSelectGame)

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
    instance.on('style.load', () => {
      instance.setProjection({ type: 'globe' })
      instance.addSource(pinSource, { type: 'geojson', data: pinFeatures(latestGames.current) })
      instance.addLayer({
        id: pinLayer,
        type: 'circle',
        source: pinSource,
        // Live stands out most (and draws on top), Upcoming is dimmer, Final fades.
        layout: { 'circle-sort-key': ['match', ['get', 'status'], 'Live', 2, 'Upcoming', 1, 0] },
        paint: {
          'circle-radius': ['match', ['get', 'status'], 'Live', 9, 'Upcoming', 6, 5],
          'circle-color': ['match', ['get', 'status'], 'Live', '#e4572e', 'Upcoming', '#f2a541', '#8a8f98'],
          'circle-opacity': ['match', ['get', 'status'], 'Live', 1, 'Upcoming', 0.8, 0.55],
          'circle-stroke-width': ['match', ['get', 'status'], 'Live', 2.5, 1.5],
          'circle-stroke-color': '#ffffff',
          'circle-stroke-opacity': ['match', ['get', 'status'], 'Final', 0.55, 1],
        },
      })
      instance.addLayer({
        id: 'pin-labels',
        type: 'symbol',
        source: pinSource,
        minzoom: 3,
        layout: {
          'text-field': ['get', 'label'],
          'text-font': ['Noto Sans Bold'],
          'text-size': 13,
          'text-offset': [0, 1.4],
          'text-anchor': 'top',
        },
        paint: {
          'text-halo-color': '#ffffff',
          'text-halo-width': 1.5,
          'text-opacity': ['match', ['get', 'status'], 'Final', 0.6, 1],
        },
      })
      // A ring around the selected game's pin.
      instance.addLayer({
        id: selectedPinLayer,
        type: 'circle',
        source: pinSource,
        filter: selectedPin(latestSelected.current),
        paint: {
          'circle-radius': 15,
          'circle-color': 'rgba(0, 0, 0, 0)',
          'circle-stroke-width': 3,
          'circle-stroke-color': '#2f80ed',
        },
      })
    })
    instance.on('click', pinLayer, (event) => {
      const gameId: unknown = event.features?.[0]?.properties?.gameId
      if (typeof gameId === 'string') latestOnSelect.current(gameId)
    })
    instance.on('mouseenter', pinLayer, () => {
      instance.getCanvas().style.cursor = 'pointer'
    })
    instance.on('mouseleave', pinLayer, () => {
      instance.getCanvas().style.cursor = ''
    })
    map.current = instance
    return () => {
      instance.remove()
      map.current = null
    }
  }, [])

  useEffect(() => {
    latestGames.current = games
    const source = map.current?.getSource<GeoJSONSource>(pinSource)
    source?.setData(pinFeatures(games))
  }, [games])

  // Only when the selection changes: later snapshots must not pull the camera back.
  useEffect(() => {
    latestSelected.current = selectedGameId
    const instance = map.current
    if (!instance) return
    if (instance.getLayer(selectedPinLayer)) instance.setFilter(selectedPinLayer, selectedPin(selectedGameId))
    const game = latestGames.current.find((g) => g.id === selectedGameId)
    if (game) instance.easeTo({ center: [game.venue.longitude, game.venue.latitude], duration: 1200 })
  }, [selectedGameId])

  return <div ref={container} className="globe" />
}
