/** Small pins when zoomed out; score cards once a country fills the screen. */
export type PinSize = 'small' | 'card'

export interface PinLayout {
  size: PinSize
  /** The pin source's cluster radius, in pixels at the whole zoom level below (see pinLayout). */
  clusterRadius: number
}

/** Zoom at which pins switch from small markers to score cards (about one country on screen). */
export const cardZoom = 3

/** Highest zoom at which pins still cluster; past it every game gets its own pin. */
export const clusterMaxZoom = 14

// Pins only cluster when they would overlap: closer on screen than the widest small pin (a Live
// one, radius 7 plus its 2 px outline, both sides), or than a score card's width with a small margin.
const smallPinWidth = 18
const cardWidth = 106

// The radius is adjusted in steps of this much zoom, so it changes (and pins re-cluster) a few
// times per zoom level rather than on every frame of a zoom.
const zoomStep = 0.25

/**
 * Small pins or score cards, and how close pins must be to cluster.
 * MapLibre clusters pins at whole zoom levels only, and shows zoom 3's clusters all the way to 3.99,
 * where pins are nearly twice as far apart on screen. So the radius is shrunk by how far past the
 * whole level the zoom is (rounded down to a step, erring towards clustering) to keep pins
 * clustering only when they'd overlap on screen now.
 */
export function pinLayout(zoom: number): PinLayout {
  const size: PinSize = zoom >= cardZoom ? 'card' : 'small'
  const pastWholeLevel = Math.floor((zoom - Math.floor(zoom)) / zoomStep) * zoomStep
  const onScreen = size === 'card' ? cardWidth : smallPinWidth
  return { size, clusterRadius: Math.round(onScreen / 2 ** pastWholeLevel) }
}
