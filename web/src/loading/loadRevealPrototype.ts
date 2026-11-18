// PROTOTYPE, throwaway: three ways to reveal the app on first load, switchable with ?loadProto=.
// Question: how should the globe's first load reveal, instead of panels popping in at different times?
//   now: today's load, for comparison
//   A: one reveal: an opaque loading screen, then everything fades in together at Ready
//   B: staged: an opaque loading screen, then the globe, then cards one after another, then the rail
//   C: today's see-through dim, with the cards, pins and names held back until Ready, then faded in
// Cycle with [ and ]; a change reloads, as it's the load being judged. Not for main.
import { useEffect, useState } from 'react'
import type { Map as MapLibreMap } from 'maplibre-gl'

type Paint = Parameters<MapLibreMap['setPaintProperty']>[1]
import type { LoadingStage } from '../globe/globeMap'
import { trailLayerId } from '../globe/trailLayer'

export const loadProtoVariants = ['now', 'A', 'B', 'C'] as const
export type Variant = (typeof loadProtoVariants)[number]
export const names: Record<Variant, string> = {
  now: 'Today',
  A: 'One reveal',
  B: 'Staged reveal',
  C: 'See-through dim, content held back',
}

const param = new URLSearchParams(window.location.search).get('loadProto')
export const loadProto: Variant = (loadProtoVariants as readonly string[]).includes(param ?? '') ? (param as Variant) : 'now'
export const root = document.documentElement
root.dataset.loadProto = loadProto
root.dataset.loadPhase = 'waiting'

/** How long after Ready each part of B comes in. */
const staged = { cardsFrom: 300, cardsOver: 600, railAt: 1100, doneAt: 1500 }
const revealMs = 400

/** Set by GlobeMap as it's made (PROTOTYPE). */
declare global {
  interface Window {
    __protoMap?: MapLibreMap
  }
}

// What each hidden layer had, to put back.
const held = new Map<string, Array<[string, unknown]>>()
const opacityProps: Record<string, string[]> = {
  symbol: ['text-opacity', 'icon-opacity'],
  circle: ['circle-opacity', 'circle-stroke-opacity'],
}

/** C hides every name and pin; B only the pins (names come with the globe). */
function shouldHold(type: string, source: unknown): boolean {
  if (loadProto === 'C') return type === 'symbol' || type === 'circle'
  if (loadProto === 'B') return type === 'circle' || (type === 'symbol' && source === 'card-layout')
  return false
}

function holdNewLayers(map: MapLibreMap) {
  // The trails and their venue dots: a custom layer, which getStyle leaves out.
  if (!held.has(trailLayerId) && map.getLayer(trailLayerId)) {
    held.set(trailLayerId, [])
    map.setLayoutProperty(trailLayerId, 'visibility', 'none')
  }
  for (const layer of map.getStyle()?.layers ?? []) {
    if (held.has(layer.id)) continue
    if (!shouldHold(layer.type, 'source' in layer ? layer.source : undefined)) continue
    const props = opacityProps[layer.type] ?? []
    held.set(
      layer.id,
      props.map((prop) => [prop, map.getPaintProperty(layer.id, prop as Paint)]),
    )
    for (const prop of props) {
      map.setPaintProperty(layer.id, `${prop}-transition` as Paint, { duration: 0, delay: 0 })
      map.setPaintProperty(layer.id, prop as Paint, 0)
    }
  }
}

function releaseLayers(map: MapLibreMap, delay: number) {
  for (const [id, props] of held) {
    if (!map.getLayer(id)) continue
    if (id === trailLayerId) {
      window.setTimeout(() => map.setLayoutProperty(id, 'visibility', 'visible'), delay + revealMs)
      continue
    }
    for (const [prop, value] of props) {
      map.setPaintProperty(id, `${prop}-transition` as Paint, { duration: revealMs, delay })
      map.setPaintProperty(id, prop as Paint, value ?? 1)
    }
  }
  map.triggerRepaint()
}

/** B: each card drops in, from the middle of the screen outward. */
function staggerCards() {
  const cards = [...document.querySelectorAll<HTMLElement>('.globe .score-card')]
  const middle = { x: window.innerWidth / 2, y: window.innerHeight / 2 }
  const distance = (card: HTMLElement) => {
    const box = card.getBoundingClientRect()
    return Math.hypot(box.x + box.width / 2 - middle.x, box.y + box.height / 2 - middle.y)
  }
  const furthest = Math.max(1, ...cards.map(distance))
  for (const card of cards) card.style.setProperty('--load-proto-delay', `${staged.cardsFrom + (distance(card) / furthest) * staged.cardsOver}ms`)
}

/**
 * Drives the variant from the load's stage, and says when the app should treat the load as done: the
 * welcome tour and the Games badge wait for it (today, the loading screen being gone).
 */
export function useLoadRevealPrototype(stage: LoadingStage, loadingScreenGone: boolean): boolean {
  const [stagedDone, setStagedDone] = useState(false)
  const ready = stage === 'ready'

  useEffect(() => {
    const map = window.__protoMap
    if (!map || (loadProto !== 'B' && loadProto !== 'C')) return
    const hold = () => {
      if (root.dataset.loadPhase === 'waiting') holdNewLayers(map)
    }
    hold()
    map.on('styledata', hold)
    map.on('render', hold)
    return () => {
      map.off('styledata', hold)
      map.off('render', hold)
    }
  }, [])

  useEffect(() => {
    if (!ready) return
    const map = window.__protoMap
    root.dataset.loadReadyAt = String(Math.round(performance.now()))
    if (loadProto === 'B') staggerCards()
    root.dataset.loadPhase = 'revealing'
    if (map && loadProto === 'C') releaseLayers(map, 0)
    if (map && loadProto === 'B') releaseLayers(map, staged.cardsFrom)
    const railTimer = window.setTimeout(() => {
      if (loadProto === 'B') root.dataset.loadRail = 'in'
      setStagedDone(true)
    }, staged.railAt)
    const doneTimer = window.setTimeout(() => (root.dataset.loadPhase = 'done'), loadProto === 'B' ? staged.doneAt + 300 : revealMs + 100)
    return () => {
      window.clearTimeout(railTimer)
      window.clearTimeout(doneTimer)
    }
  }, [ready])

  if (loadProto === 'now') return loadingScreenGone
  if (loadProto === 'B') return stagedDone
  return ready
}

