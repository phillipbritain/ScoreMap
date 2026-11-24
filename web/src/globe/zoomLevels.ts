import type { MapType } from '../settings/viewerSettings'
import settingsFile from './zoomSettings.json'

/** How far out and in the globe zooms, and where it starts. */
export interface ZoomSettings {
  /**
   * The furthest out: the whole globe on screen with space around it, at furthestOutFill of the view's
   * shorter side, so it depends on the view's size (see fittedZoomSettings). MapLibre's globe measures
   * this at the equator: elsewhere the zoom can go lower while the globe stays the same size on screen
   * (see furthestOutZoom).
   */
  minZoom: number
  /**
   * The zoom a first visit opens at, and Home flies back to, measured at the equator as minZoom is.
   * Never further out than minZoom.
   */
  startZoom: number
  /** The furthest in on the plain map, where buildings are shown in 3D. */
  maxZoom: number
  /**
   * The furthest in on the satellite map, where buildings are shown over imagery. Past about 14
   * the imagery's pixels (10 m) only grow.
   */
  satelliteMaxZoom: number
}

/**
 * How much of the view's shorter side the whole globe fills zoomed fully out (see minZoom), from
 * zoomSettings.json.
 */
export const { furthestOutFill } = settingsFile
const { furthestOutFill: _, ...limits } = settingsFile

/** MapLibre's vertical field of view, in degrees: its default (about 36.87), which the globe keeps. */
export const fieldOfView = (Math.atan(0.75) * 180) / Math.PI

/**
 * The zoom, measured at the equator, at which the whole globe is `across` pixels across in a view
 * `height` pixels tall. MapLibre's camera sits above the middle of the view, so the globe's rim is
 * nearer the camera than its center and the globe looks smaller than its radius at the zoom: by
 * more in a short view, whose camera is nearer (see centerLatitude).
 */
export function wholeGlobeZoom(across: number, height: number): number {
  const cameraHeight = (0.5 / Math.tan((fieldOfView * Math.PI) / 360)) * height
  const seen = across / 2
  // The globe's radius whose rim, seen from the camera, is `seen` pixels from the middle of the view.
  const radius = (seen * seen + seen * Math.hypot(seen, cameraHeight)) / cameraHeight
  return Math.log2((2 * Math.PI * radius) / tileSize)
}

/**
 * The shorter side of the view, in pixels, that startZoom is set for: a laptop's browser window.
 */
export const minZoomView = 800

/** A laptop's browser window, the view the app's zoom settings are for until fitted to the window's. */
export const laptopView = { width: 1280, height: minZoomView }

/**
 * The zoom settings for a view this size. The furthest out is the whole globe filling furthestOutFill
 * of the view's shorter side, in any view. A zoom is a scale in pixels, so a start zoom would fill a
 * phone far more than a laptop: a view whose shorter side is under minZoomView starts further out
 * (and Home is as far out), in proportion, at the same size of globe on screen as on a laptop. The
 * furthest in stays as it is.
 */
export function fittedZoomSettings(settings: Omit<ZoomSettings, 'minZoom'>, view: { width: number; height: number }): ZoomSettings {
  // A view with no size yet (a hidden page) is fitted as a laptop's.
  const { width, height } = Math.min(view.width, view.height) > 0 ? view : laptopView
  const shorter = Math.min(width, height)
  const fit = shorter < minZoomView ? Math.log2(shorter / minZoomView) : 0
  return {
    ...settings,
    minZoom: wholeGlobeZoom(furthestOutFill * shorter, height),
    startZoom: settings.startZoom + fit,
  }
}

/** MapLibre's tiles' size in pixels, which sets how big the globe is at a zoom. */
const tileSize = 512

/** The app's zoom settings, from zoomSettings.json, for a laptop's browser window (see fittedZoomSettings). */
export const zoomSettings: ZoomSettings = fittedZoomSettings(limits, laptopView)

export const { minZoom, maxZoom } = zoomSettings

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
 * place is where the camera's ray through its point meets the globe. On a phone, with the event panel
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

/** The furthest from the equator MapLibre centers the view. */
const maxLatitude = 85.051129

/** The zoom MapLibre allows furthest out with the view centered at this latitude, given the furthest out at the equator. */
export function furthestOutZoom(latitude: number, furthestOut = minZoom): number {
  return zoomAt(latitude, furthestOut)
}
