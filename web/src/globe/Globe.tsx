import { Map as MapLibreMap, setWorkerUrl, type GeoJSONSource } from 'maplibre-gl'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
import 'maplibre-gl/dist/maplibre-gl.css'
import type { Point } from 'geojson'
import { useEffect, useRef } from 'react'
import type { Game } from '../games/game'
import { pinFeatures } from './pinFeatures'
import { clusterLayer, clusterLayers, pinSource, pinSourceSpec, smallPinLayerSpec } from './pinLayers'
import { ScoreCardMarkers } from './scoreCardMarkers'
import { clusterMaxZoom, pinLayout } from './zoomLevels'

// MapLibre's default worker path doesn't survive Vite's bundling.
setWorkerUrl(workerUrl)

// Free vector tiles with borders and place labels (ADR-0004).
const mapStyle = 'https://tiles.openfreemap.org/styles/liberty'

interface GlobeProps {
  games: readonly Game[]
}

/**
 * MapLibre globe with a pin at each game's venue. Zoomed out, pins are small and nearby ones form
 * clusters with counts; zoomed in, each pin becomes a score card. Selecting a cluster zooms in until it splits.
 */
export function Globe({ games }: GlobeProps) {
  const container = useRef<HTMLDivElement>(null)
  const map = useRef<MapLibreMap | null>(null)
  const cards = useRef<ScoreCardMarkers | null>(null)
  const latestGames = useRef(games)

  useEffect(() => {
    if (!container.current) return
    const instance = new MapLibreMap({
      container: container.current,
      style: mapStyle,
      center: [-40, 30],
      zoom: 1.5,
    })
    const scoreCards = new ScoreCardMarkers(instance)
    scoreCards.setGames(latestGames.current)
    let clusterRadius = pinLayout(instance.getZoom()).clusterRadius

    instance.on('style.load', () => {
      instance.setProjection({ type: 'globe' })
      clusterRadius = pinLayout(instance.getZoom()).clusterRadius
      instance.addSource(pinSource, pinSourceSpec(pinFeatures(latestGames.current), instance.getZoom()))
      for (const layer of clusterLayers) instance.addLayer(layer)
      instance.addLayer(smallPinLayerSpec)
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
    instance.on('mouseenter', clusterLayer, () => (instance.getCanvas().style.cursor = 'pointer'))
    instance.on('mouseleave', clusterLayer, () => (instance.getCanvas().style.cursor = ''))

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

  return <div ref={container} className="globe" />
}
