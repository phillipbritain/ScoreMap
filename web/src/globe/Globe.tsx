import { Map as MapLibreMap, type GeoJSONSource } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { useEffect, useRef } from 'react'
import type { Game } from '../games/game'
import { pinFeatures } from './pinFeatures'

// Free vector tiles with borders and place labels (ADR-0004).
const mapStyle = 'https://tiles.openfreemap.org/styles/liberty'
const pinSource = 'pins'

interface GlobeProps {
  games: readonly Game[]
}

/** MapLibre globe with a pin at each game's venue. */
export function Globe({ games }: GlobeProps) {
  const container = useRef<HTMLDivElement>(null)
  const map = useRef<MapLibreMap | null>(null)
  const latestGames = useRef(games)

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
        id: 'pins',
        type: 'circle',
        source: pinSource,
        paint: {
          'circle-radius': 7,
          'circle-color': '#e4572e',
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff',
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
        paint: { 'text-halo-color': '#ffffff', 'text-halo-width': 1.5 },
      })
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

  return <div ref={container} className="globe" />
}
