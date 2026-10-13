import { degreesApart, type GlobePoint } from './geo'

/**
 * Small pins when zoomed out; score cards once a country fills the screen, for games near the centre
 * of the view (see hasCard).
 */
export type PinSize = 'small' | 'card'

export interface PinLayout {
  /**
   * Small pins form pin clusters; score cards don't, since cards find room among themselves and
   * form card clusters only when there is none (see cardLayout).
   */
  size: PinSize
  /** The pin source's cluster radius while small pins show, in pixels at the whole zoom level below (see pinLayout). */
  clusterRadius: number
}

/** Zoom at which pins switch from small markers to score cards (about one country on screen). */
export const cardZoom = 3

/**
 * How far from the centre of the view a game's venue can be, in degrees of arc, and still have a score
 * card. Farther games show as small pins, so cards don't crowd the globe's rim.
 */
export const cardRadius = 40

/** Whether a game has a score card at card zoom: its venue is within cardRadius of the view's centre. */
export function hasCard(centre: GlobePoint, venue: GlobePoint): boolean {
  return degreesApart(centre, venue) <= cardRadius
}

/**
 * The furthest out the globe zooms: the whole globe on a laptop screen, with small pins and their
 * clusters. MapLibre's globe measures this at the equator: elsewhere the zoom can go lower while the
 * globe stays the same size on screen (see furthestOutZoom).
 */
export const minZoom = 2

/** The zoom MapLibre allows furthest out with the view centred at this latitude. */
export function furthestOutZoom(latitude: number): number {
  return minZoom + Math.log2(Math.cos((latitude * Math.PI) / 180))
}

/** The furthest in the globe zooms: a neighbourhood, a few kilometres across. */
export const maxZoom = 13

/**
 * Highest zoom at which the pin source clusters. Small pins stop showing well before it, at cardZoom,
 * and score cards aren't in pin clusters, so this only needs to be past cardZoom.
 */
export const clusterMaxZoom = maxZoom - 1

/** Small pins or score cards, by the zoom. */
export function pinSize(zoom: number): PinSize {
  return zoom >= cardZoom ? 'card' : 'small'
}

// The radius is adjusted in steps of this much zoom, so it changes (and pins re-cluster) a few
// times per zoom level rather than on every frame of a zoom.
const zoomStep = 0.25

/**
 * Small pins or score cards, and how close small pins must be to cluster: only when they would
 * overlap, closer on screen than the widest small pin.
 * MapLibre clusters pins at whole zoom levels only, and shows zoom 3's clusters all the way to 3.99,
 * where pins are nearly twice as far apart on screen. So the radius is shrunk by how far past the
 * whole level the zoom is (rounded down to a step, erring towards clustering) to keep pins
 * clustering only as close as they'd be on screen now.
 */
export function pinLayout(zoom: number, smallPinWidth: number): PinLayout {
  const size = pinSize(zoom)
  const pastWholeLevel = Math.floor((zoom - Math.floor(zoom)) / zoomStep) * zoomStep
  return { size, clusterRadius: Math.round(smallPinWidth / 2 ** pastWholeLevel) }
}
