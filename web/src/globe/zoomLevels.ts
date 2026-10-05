/** Small pins when zoomed out; score cards once zoomed in to a region. */
export type PinSize = 'small' | 'card'

export interface PinLayout {
  size: PinSize
  /** Pins closer than this many screen pixels group into a cluster. */
  clusterRadius: number
}

/** Zoom at which pins switch from small markers to score cards (about one region of a country on screen). */
export const cardZoom = 5

/** Highest zoom at which pins still cluster; past it every game gets its own pin. */
export const clusterMaxZoom = 14

const small: PinLayout = { size: 'small', clusterRadius: 40 }
// Roughly a card's width, so neighbouring cards cluster rather than overlap.
const card: PinLayout = { size: 'card', clusterRadius: 110 }

export function pinLayout(zoom: number): PinLayout {
  return zoom >= cardZoom ? card : small
}
