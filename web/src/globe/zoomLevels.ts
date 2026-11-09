import { degreesApart, type GlobePoint } from './geo'
import limits from './zoomSettings.json'

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

/**
 * Zoom at which pins switch from small markers to score cards (about one country on screen), in a
 * view the size of a laptop's browser window: a smaller one, such as a phone's, switches further out
 * (see fittedZoomSettings).
 */
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

/** How far out and in the globe zooms, and where it starts (on a local run, the behaviour tuner can change them). */
export interface ZoomSettings {
  /**
   * The furthest out: just short of cardZoom, so small pins and their clusters still show.
   * MapLibre's globe measures this at the equator: elsewhere the zoom can go lower while the globe
   * stays the same size on screen (see furthestOutZoom). It's for a view the size of a laptop's
   * browser window: a smaller one, such as a phone's, can zoom further out (see fittedZoomSettings).
   */
  minZoom: number
  /**
   * The zoom a first visit opens at, and Home flies back to, measured at the equator as minZoom is.
   * Never further out than minZoom.
   */
  startZoom: number
  /** The furthest in: a city, some ten kilometres across. */
  maxZoom: number
}

/** The app's zoom settings, from zoomSettings.json. */
export const zoomSettings: ZoomSettings = limits

export const { minZoom, maxZoom } = zoomSettings

/**
 * The shorter side of the view, in pixels, that minZoom is set for: a laptop's browser window, where
 * the globe zoomed fully out is a little taller than the view.
 */
export const minZoomView = 800

/** Zoom settings fitted to a view (see fittedZoomSettings), with the zoom score cards show from. */
export interface FittedZoom extends ZoomSettings {
  /** Where pins switch from small markers to score cards: cardZoom, fitted to the view as minZoom is. */
  cardZoom: number
}

/** The app's zoom settings as they are, for a laptop-sized view or larger. */
export const unfittedZoom: FittedZoom = { ...zoomSettings, cardZoom }

/**
 * The zoom settings for a view this size. A zoom is a scale in pixels, so the globe at a zoom is the
 * same number of pixels across in any view, and would fill a phone far more than a laptop. A view
 * whose shorter side is under minZoomView zooms out further, in proportion, so the globe zoomed fully
 * out fills it as it fills a laptop's. Score cards show from further out alike, and the start zoom
 * (and Home) is as far out alike: each comes at the same size of globe on screen as on a laptop.
 * The furthest in stays as it is: a city on a phone. A larger view keeps the settings as they are.
 */
export function fittedZoomSettings(settings: ZoomSettings, view: { width: number; height: number }): FittedZoom {
  const shorter = Math.min(view.width, view.height)
  // A view with no size yet (a hidden page) has nothing to fit.
  const fit = shorter > 0 && shorter < minZoomView ? Math.log2(shorter / minZoomView) : 0
  return {
    ...settings,
    minZoom: settings.minZoom + fit,
    startZoom: settings.startZoom + fit,
    cardZoom: cardZoom + fit,
  }
}

/** The zoom MapLibre allows furthest out with the view centred at this latitude, given the furthest out at the equator. */
export function furthestOutZoom(latitude: number, furthestOut = minZoom): number {
  return furthestOut + Math.log2(Math.cos((latitude * Math.PI) / 180))
}

/**
 * Highest zoom at which the pin source clusters. Small pins stop showing well before it, at the card
 * zoom, and score cards aren't in pin clusters, so this only needs to be past it.
 */
export const clusterMaxZoom = maxZoom - 1

/** Small pins or score cards, by the zoom and the zoom cards show from (see FittedZoom). */
export function pinSize(zoom: number, cardsFrom: number): PinSize {
  return zoom >= cardsFrom ? 'card' : 'small'
}

// The radius is adjusted in steps of this much zoom, so it changes (and pins re-cluster) a few
// times per zoom level rather than on every frame of a zoom.
const zoomStep = 0.25

/**
 * Small pins or score cards, and how close small pins must be to cluster: closer on screen than the
 * spacing, which keeps small pins and pin clusters from overlapping (see pinClusterSpacing).
 * MapLibre clusters pins at whole zoom levels only, and shows zoom 3's clusters all the way to 3.99,
 * where pins are nearly twice as far apart on screen. So the radius is shrunk by how far past the
 * whole level the zoom is (rounded down to a step, erring towards clustering) to keep pins
 * clustering only as close as they'd be on screen now.
 */
export function pinLayout(zoom: number, spacing: number, cardsFrom: number): PinLayout {
  const size = pinSize(zoom, cardsFrom)
  const pastWholeLevel = Math.floor((zoom - Math.floor(zoom)) / zoomStep) * zoomStep
  return { size, clusterRadius: Math.round(spacing / 2 ** pastWholeLevel) }
}
