import { degreesApart, type GlobePoint } from './geo'
import type { MapType } from '../settings/viewerSettings'
import limits from './zoomSettings.json'

/**
 * Small pins when zoomed out; score cards once a country fills the screen, for games near the center
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
 * Zoom at which pins switch from small markers to score cards (about one country on screen), measured
 * at the equator wherever the globe is turned (see zoomAt), in a view the size of a laptop's browser window: a smaller one, such as a phone's, switches further out
 * (see fittedZoomSettings).
 */
export const cardZoom = 3

/**
 * How far from the center of the view a game's venue can be, in degrees of arc, and still have a score
 * card. Farther games show as small pins, so cards don't crowd the globe's rim.
 */
export const cardRadius = 40

/** Whether a game has a score card at card zoom: its venue is within cardRadius of the view's center. */
export function hasCard(center: GlobePoint, venue: GlobePoint): boolean {
  return degreesApart(center, venue) <= cardRadius
}

/** How far out and in the globe zooms, and where it starts. */
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
  /** The furthest in on the plain map: a city, some ten kilometers across. */
  maxZoom: number
  /**
   * The furthest in on the satellite map, which has more to see close in: a neighborhood. Past about
   * 14 the imagery's pixels (10 m) only grow.
   */
  satelliteMaxZoom: number
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

/**
 * The zoom settings for a map type: the furthest in is the satellite map's on satellite
 * (satelliteMaxZoom), else the plain map's (maxZoom), and the rest are the same on both.
 */
export function zoomForMapType<Z extends ZoomSettings>(settings: Z, mapType: MapType): Z {
  return mapType === 'satellite' ? { ...settings, maxZoom: settings.satelliteMaxZoom } : settings
}

/**
 * MapLibre's zoom with the view centered at this latitude for a zoom measured at the equator: the same
 * size of globe on screen. Its globe grows away from the equator at the same zoom (by one over the
 * cosine of the latitude), so the zoom there is lower for the same globe. Every zoom the app sets,
 * such as cardZoom and minZoom, is measured at the equator, so it stands for one size of globe
 * wherever the globe is turned.
 */
export function zoomAt(latitude: number, atEquator: number): number {
  return atEquator + Math.log2(Math.cos((latitude * Math.PI) / 180))
}

/**
 * MapLibre's zoom with the view centered at this latitude, measured at the equator (see zoomAt): the same
 * whatever the latitude for the same size of globe on screen, so turning the globe leaves it as it is.
 * MapLibre calls it the normalized zoom.
 */
export function zoomAtEquator({ zoom, latitude }: GlobeCamera): number {
  return zoom - zoomAt(latitude, 0)
}

/** MapLibre's zoom, and the latitude the view is centered at. */
export interface GlobeCamera {
  zoom: number
  latitude: number
}

/**
 * The latitude the view's center lands at when the globe is turned so a place at `latitude` sits
 * `below` pixels under the middle of the view (above it, if negative), the globe the size of the zoom
 * `atEquator` (see zoomAt), in a view `height` pixels tall seen through MapLibre's camera with a
 * vertical field of view of `fov` degrees. MapLibre's camera looks straight down at the middle of the
 * view, from as far above the globe's surface as a view this tall needs for its field of view; the
 * place is where the camera's ray through its point meets the globe. On a phone, with the game panel
 * up, the center can be some forty degrees from the game.
 */
export function centerLatitude(latitude: number, below: number, atEquator: number, { height, fov }: { height: number; fov: number }): number {
  // The globe's radius in pixels: as big at a zoom measured at the equator wherever it's turned.
  const radius = (tileSize * 2 ** atEquator) / (2 * Math.PI)
  const cameraHeight = 0.5 / Math.tan((fov * Math.PI) / 360) * height
  const ray = Math.atan(Math.abs(below) / cameraHeight)
  // The angle at the globe's center between the middle of the view and the place.
  const apart = Math.asin(Math.min(1, ((cameraHeight + radius) * Math.sin(ray)) / radius)) - ray
  const center = latitude + Math.sign(below) * ((apart * 180) / Math.PI)
  return Math.max(-maxLatitude, Math.min(maxLatitude, center))
}

/** MapLibre's tiles' size in pixels, which sets how big the globe is at a zoom. */
const tileSize = 512

/** The furthest from the equator MapLibre centers the view. */
const maxLatitude = 85.051129

/** The zoom MapLibre allows furthest out with the view centered at this latitude, given the furthest out at the equator. */
export function furthestOutZoom(latitude: number, furthestOut = minZoom): number {
  return zoomAt(latitude, furthestOut)
}

/**
 * Highest zoom at which the pin source clusters. Small pins stop showing well before it, at the card
 * zoom, and score cards aren't in pin clusters, so this only needs to be past it.
 */
export const clusterMaxZoom = maxZoom - 1

/**
 * Small pins or score cards, by the size of the globe on screen: the camera's zoom measured at the
 * equator (see zoomAtEquator) against the zoom cards show from (see FittedZoom). So turning the globe
 * never brings cards in or takes them away; only zooming does. Within a millionth of a zoom level
 * counts as there, so a zoom set to the card zoom at some latitude (see zoomAt) has cards.
 */
export function pinSize(camera: GlobeCamera, cardsFrom: number): PinSize {
  return zoomAtEquator(camera) >= cardsFrom - 1e-6 ? 'card' : 'small'
}

/**
 * The zoom city names show from (see PlaceNames.showFrom), in MapLibre's zoom, for the pins showing
 * now: with score cards, from any zoom (MapLibre takes a minimum of 0 as none, as its zoom goes below
 * 0 near the poles); with small pins, from past the furthest in. A layer's zoom range is in MapLibre's
 * zoom, which changes as the globe turns (see zoomAt), so it can't hold the card zoom itself.
 */
export function cityNamesFrom(size: PinSize): number {
  return size === 'card' ? 0 : 24
}

// The radius is adjusted in steps of this much zoom, so it changes (and pins re-cluster) a few
// times per zoom level rather than on every frame of a zoom.
const zoomStep = 0.25

/**
 * Small pins or score cards (see pinSize), and how close small pins must be to cluster: closer on screen than the
 * spacing, which keeps small pins and pin clusters from overlapping (see pinClusterSpacing).
 * MapLibre clusters pins at whole zoom levels only, and shows zoom 3's clusters all the way to 3.99,
 * where pins are nearly twice as far apart on screen. So the radius is shrunk by how far past the
 * whole level the zoom is (rounded down to a step, erring toward clustering) to keep pins
 * clustering only as close as they'd be on screen now.
 */
export function pinLayout(camera: GlobeCamera, spacing: number, cardsFrom: number): PinLayout {
  const size = pinSize(camera, cardsFrom)
  // MapLibre's own zoom: it clusters at its whole zoom levels, wherever the globe is turned.
  const { zoom } = camera
  const pastWholeLevel = Math.floor((zoom - Math.floor(zoom)) / zoomStep) * zoomStep
  return { size, clusterRadius: Math.round(spacing / 2 ** pastWholeLevel) }
}
