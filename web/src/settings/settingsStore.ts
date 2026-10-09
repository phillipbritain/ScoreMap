import type { Camera } from '../globe/camera'
import { isCardStyle } from '../globe/cardStyle'
import { firstVisitSettings, type ViewerSettings } from './viewerSettings'

/** The part of the browser's localStorage the store uses. */
export type SettingsStorage = Pick<Storage, 'getItem' | 'setItem'>

export interface SettingsStore {
  load(): ViewerSettings
  save(settings: ViewerSettings): void
  /** Where the viewer left the globe, or null on a first visit. */
  loadCamera(): Camera | null
  saveCamera(camera: Camera): void
}

const key = 'scoremap.settings'
// Kept apart from the settings because it is saved every time the globe stops moving.
const cameraKey = 'scoremap.camera'

/**
 * Saves viewer settings in browser storage. Storage is reached through a function because merely
 * reading `window.localStorage` can throw when the browser blocks it; the store then falls back to
 * first-visit settings and quietly skips saving, so the app still works.
 */
export function settingsStore(storage: () => SettingsStorage): SettingsStore {
  return {
    load() {
      try {
        const saved = storage().getItem(key)
        return saved === null ? firstVisitSettings : fromSaved(JSON.parse(saved))
      } catch {
        return firstVisitSettings
      }
    },
    save(settings) {
      try {
        storage().setItem(key, JSON.stringify(settings))
      } catch {
        // Settings just won't be remembered in this browser.
      }
    },
    loadCamera() {
      try {
        const saved = storage().getItem(cameraKey)
        return saved === null ? null : cameraFromSaved(JSON.parse(saved))
      } catch {
        return null
      }
    },
    saveCamera(camera) {
      try {
        storage().setItem(cameraKey, JSON.stringify(camera))
      } catch {
        // The globe will just open on the viewer's region next time.
      }
    },
  }
}

/** A saved camera, or null when what was saved isn't one. */
function cameraFromSaved(saved: unknown): Camera | null {
  if (typeof saved !== 'object' || saved === null) return null
  const { longitude, latitude, zoom } = saved as Record<string, unknown>
  return Number.isFinite(longitude) && Number.isFinite(latitude) && Number.isFinite(zoom)
    ? { longitude: longitude as number, latitude: latitude as number, zoom: zoom as number }
    : null
}

/**
 * Reads saved settings field by field, so settings saved by an older version of the app (or
 * damaged ones) keep what is still valid and take first-visit defaults for the rest.
 */
function fromSaved(saved: unknown): ViewerSettings {
  const fields = typeof saved === 'object' && saved !== null ? (saved as Record<string, unknown>) : {}
  const { hiddenLeagues, liveOnly, showDisrupted, cardStyle } = fields
  return {
    hiddenLeagues: Array.isArray(hiddenLeagues)
      ? hiddenLeagues.filter((league): league is string => typeof league === 'string')
      : firstVisitSettings.hiddenLeagues,
    liveOnly: typeof liveOnly === 'boolean' ? liveOnly : firstVisitSettings.liveOnly,
    showDisrupted: typeof showDisrupted === 'boolean' ? showDisrupted : firstVisitSettings.showDisrupted,
    cardStyle: isCardStyle(cardStyle) ? cardStyle : firstVisitSettings.cardStyle,
  }
}
