import { degreesApart, type GlobePoint } from './geo'
import type { MapType } from '../settings/viewerSettings'
import limits from './zoomSettings.json'

/**
 * How far from the center of the view a game's venue can be, in degrees of arc, and still have a score
 * card, at any zoom. Farther games show as small pins (outer pins), so cards don't crowd the globe's rim.
 */
export const cardRadius = 40

/** Whether a game has a score card: its venue is within cardRadius of the view's center. */
export function hasCard(center: GlobePoint, venue: GlobePoint): boolean {
  return degreesApart(center, venue) <= cardRadius
}

/** How far out and in the globe zooms, and where it starts. */
export interface ZoomSettings {
  /**
   * The furthest out: about the whole globe on screen. MapLibre's globe measures this at the equator: elsewhere the zoom can go lower while the globe
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

/**
 * The zoom settings for a view this size. A zoom is a scale in pixels, so the globe at a zoom is the
 * same number of pixels across in any view, and would fill a phone far more than a laptop. A view
 * whose shorter side is under minZoomView zooms out further, in proportion, so the globe zoomed fully
 * out fills it as it fills a laptop's. The start zoom (and Home) is as far out alike: each comes at the same size of globe on screen as on a laptop.
 * The furthest in stays as it is: a city on a phone. A larger view keeps the settings as they are.
 */
export function fittedZoomSettings(settings: ZoomSettings, view: { width: number; height: number }): ZoomSettings {
  const shorter = Math.min(view.width, view.height)
  // A view with no size yet (a hidden page) has nothing to fit.
  const fit = shorter > 0 && shorter < minZoomView ? Math.log2(shorter / minZoomView) : 0
  return {
    ...settings,
    minZoom: settings.minZoom + fit,
    startZoom: settings.startZoom + fit,
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
 * such as minZoom, is measured at the equator, so it stands for one size of globe
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
 * Highest zoom at which the outer pin source clusters. Score cards aren't in pin clusters, so outer
 * pins only need to stop clustering by the furthest in.
 */
export const clusterMaxZoom = maxZoom - 1

// The radius is adjusted in steps of this much zoom, so it changes (and pins re-cluster) a few
// times per zoom level rather than on every frame of a zoom.
const zoomStep = 0.25

/**
 * How close small pins must be to cluster at MapLibre's zoom `zoom`, in pixels at the whole zoom level
 * below: closer on screen than the spacing, which keeps small pins and pin clusters from overlapping
 * (see pinClusterSpacing). MapLibre clusters pins at whole zoom levels only, and shows zoom 3's
 * clusters all the way to 3.99, where pins are nearly twice as far apart on screen. So the radius is
 * shrunk by how far past the whole level the zoom is (rounded down to a step, erring toward
 * clustering) to keep pins clustering only as close as they'd be on screen now. It's MapLibre's own
 * zoom, as it clusters at its whole zoom levels wherever the globe is turned.
 */
export function pinClusterRadius(zoom: number, spacing: number): number {
  const pastWholeLevel = Math.floor((zoom - Math.floor(zoom)) / zoomStep) * zoomStep
  return Math.round(spacing / 2 ** pastWholeLevel)
}
