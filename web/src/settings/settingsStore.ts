import type { Camera } from '../globe/camera'
import { isHexColor } from '../theme/palette'
import type { TourProgress } from '../welcomeTour/welcomeTour'
import { firstVisitSettings, type ViewerSettings } from './viewerSettings'

/** The part of the browser's localStorage the store uses. */
export type SettingsStorage = Pick<Storage, 'getItem' | 'setItem'>

export interface SettingsStore {
  load(): ViewerSettings
  save(settings: ViewerSettings): void
  /** Where the viewer left the globe, or null on a first visit. */
  loadCamera(): Camera | null
  saveCamera(camera: Camera): void
  /**
   * How far the viewer has got through the welcome tour: Welcome on a first visit (nothing saved),
   * finished for a viewer with settings saved before the tour existed.
   */
  loadTourProgress(): TourProgress
  saveTourProgress(progress: TourProgress): void
}

const key = 'scoremap.settings'
// Kept apart from the settings because it is saved every time the globe stops moving.
const cameraKey = 'scoremap.camera'
// Kept apart from the settings, so settings saved before the tour existed can be told from a first visit.
const tourKey = 'scoremap.welcomeTour'

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
    loadTourProgress() {
      let saved: string | null
      try {
        saved = storage().getItem(tourKey)
        // No progress saved: a first visit, or a viewer from before the tour existed.
        if (saved === null) return storage().getItem(key) === null ? 'welcome' : 'finished'
      } catch {
        // Nothing can be remembered, so every visit is a first one.
        return 'welcome'
      }
      return tourProgressFromSaved(saved)
    },
    saveTourProgress(progress) {
      try {
        storage().setItem(tourKey, JSON.stringify(progress))
      } catch {
        // The tour will just show again from Welcome next time.
      }
    },
  }
}

/**
 * A store for a demo (ADR-0019), which opens on first-visit settings and the viewer's region, as every
 * demo does, and saves nothing, so the viewer's own saved settings are as they were after it.
 */
export function unsavedSettingsStore(): SettingsStore {
  return {
    load: () => firstVisitSettings,
    save() {},
    loadCamera: () => null,
    saveCamera() {},
    loadTourProgress: () => 'welcome',
    saveTourProgress() {},
  }
}

const tourSteps: readonly string[] = ['welcome', 'controls', 'scoreCard', 'finished'] satisfies TourProgress[]

/**
 * Saved tour progress. What was saved but can't be read counts as finished: the viewer has been here
 * before, and a tour shown again is worse than one missed.
 */
function tourProgressFromSaved(saved: string): TourProgress {
  try {
    const progress: unknown = JSON.parse(saved)
    return typeof progress === 'string' && tourSteps.includes(progress) ? (progress as TourProgress) : 'finished'
  } catch {
    return 'finished'
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
 * damaged ones) keep what is still valid and take first-visit defaults for the rest. Settings the
 * app no longer has, such as the old "Card style", are ignored.
 */
function fromSaved(saved: unknown): ViewerSettings {
  const fields = typeof saved === 'object' && saved !== null ? (saved as Record<string, unknown>) : {}
  const { hiddenLeagues, topEventsOnly, liveOnly, showDisrupted, sportColours, leagueColours } = fields
  return {
    hiddenLeagues: Array.isArray(hiddenLeagues)
      ? hiddenLeagues.filter((league): league is string => typeof league === 'string')
      : firstVisitSettings.hiddenLeagues,
    topEventsOnly: typeof topEventsOnly === 'boolean' ? topEventsOnly : firstVisitSettings.topEventsOnly,
    liveOnly: typeof liveOnly === 'boolean' ? liveOnly : firstVisitSettings.liveOnly,
    showDisrupted: typeof showDisrupted === 'boolean' ? showDisrupted : firstVisitSettings.showDisrupted,
    sportColours: coloursFromSaved(sportColours),
    leagueColours: coloursFromSaved(leagueColours),
  }
}

/** Saved colours by name, keeping each that is a #rrggbb colour. */
function coloursFromSaved(saved: unknown): Record<string, string> {
  if (typeof saved !== 'object' || saved === null || Array.isArray(saved)) return {}
  return Object.fromEntries(Object.entries(saved).filter((entry): entry is [string, string] => isHexColor(entry[1])))
}
