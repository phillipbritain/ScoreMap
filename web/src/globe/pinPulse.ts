import { Marker, type Map as MapLibreMap } from 'maplibre-gl'
import { isBehindGlobe } from './horizon'
import type { PinAnimation } from './pinAnimation'
import { statusLooks } from './statusLook'

/** The status a game is in once each animation's change has happened, which colours the pulse. */
const pulseColors: Record<PinAnimation, string> = {
  score: statusLooks.Live.color,
  start: statusLooks.Live.color,
  finish: statusLooks.Final.color,
}

/**
 * Plays an animation over a small pin or a cluster. They're drawn by map layers, which can't run
 * CSS animations, so a short-lived HTML marker draws expanding rings over them and then removes itself.
 * Nothing plays on the far side of the globe, where MapLibre hides the pins but would only fade the marker.
 */
export function pulse(map: MapLibreMap, lngLat: [number, number], animation: PinAnimation, over: 'pin' | 'cluster'): void {
  if (isBehindGlobe(map, lngLat)) return
  const element = document.createElement('div')
  element.style.pointerEvents = 'none'
  const ring = document.createElement('div')
  ring.className = `pin-pulse pin-pulse--${over} pin-pulse--${animation}`
  ring.style.setProperty('--pulse-color', pulseColors[animation])
  element.append(ring)

  const marker = new Marker({ element }).setLngLat(lngLat).addTo(map)
  const remove = () => marker.remove()
  ring.addEventListener('animationend', remove, { once: true })
  // In case the animation never runs (a hidden tab, say), don't leave the marker behind.
  setTimeout(remove, 5000)
}
