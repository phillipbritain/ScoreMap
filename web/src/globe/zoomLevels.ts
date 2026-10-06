/** Small pins when zoomed out; score cards once a country fills the screen. */
export type PinSize = 'small' | 'card'

export interface PinLayout {
  size: PinSize
  /** The pin source's cluster radius, in pixels at the whole zoom level below (see pinLayout). */
  clusterRadius: number
}

/** Zoom at which pins switch from small markers to score cards (about one country on screen). */
export const cardZoom = 3

/**
 * The furthest out the globe zooms, about the whole of the US on screen. MapLibre's globe measures
 * this at the equator: elsewhere the zoom can go lower while the globe stays the same size on screen
 * (see furthestOutZoom), so small pins still show looking far north or south of about 50°.
 */
export const minZoom = 3.7

/** The zoom MapLibre allows furthest out with the view centred at this latitude. */
export function furthestOutZoom(latitude: number): number {
  return minZoom + Math.log2(Math.cos((latitude * Math.PI) / 180))
}

/** The furthest in the globe zooms: a neighbourhood, a few kilometres across. */
export const maxZoom = 13

/**
 * Highest zoom at which pins still cluster; past it every game gets its own pin. One below maxZoom,
 * so at the limit every game has its own card (games at the same venue are spread apart, see colocatedPins).
 */
export const clusterMaxZoom = maxZoom - 1

// Small pins only cluster when they would overlap: closer on screen than the widest small pin (a
// Live one, radius 7 plus its 2 px outline, both sides). Score cards that would overlap are moved
// apart instead (see cardSpread), so they only cluster within half a card's width, where they'd
// have to move too far from their venues.
const smallPinWidth = 18
const cardWidth = 106
const cardClusterWidth = cardWidth / 2

// The radius is adjusted in steps of this much zoom, so it changes (and pins re-cluster) a few
// times per zoom level rather than on every frame of a zoom.
const zoomStep = 0.25

/**
 * Small pins or score cards, and how close pins must be to cluster.
 * MapLibre clusters pins at whole zoom levels only, and shows zoom 3's clusters all the way to 3.99,
 * where pins are nearly twice as far apart on screen. So the radius is shrunk by how far past the
 * whole level the zoom is (rounded down to a step, erring towards clustering) to keep pins
 * clustering only as close as they'd be on screen now.
 */
export function pinLayout(zoom: number): PinLayout {
  const size: PinSize = zoom >= cardZoom ? 'card' : 'small'
  const pastWholeLevel = Math.floor((zoom - Math.floor(zoom)) / zoomStep) * zoomStep
  const onScreen = size === 'card' ? cardClusterWidth : smallPinWidth
  return { size, clusterRadius: Math.round(onScreen / 2 ** pastWholeLevel) }
}
