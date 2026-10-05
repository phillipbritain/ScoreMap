import { firstVisitSettings, type ViewerSettings } from './viewerSettings'

/** The part of the browser's localStorage the store uses. */
export type SettingsStorage = Pick<Storage, 'getItem' | 'setItem'>

export interface SettingsStore {
  load(): ViewerSettings
  save(settings: ViewerSettings): void
}

const key = 'scoremap.settings'

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
  }
}

/**
 * Reads saved settings field by field, so settings saved by an older version of the app (or
 * damaged ones) keep what is still valid and take first-visit defaults for the rest.
 */
function fromSaved(saved: unknown): ViewerSettings {
  const fields = typeof saved === 'object' && saved !== null ? (saved as Record<string, unknown>) : {}
  const { hiddenLeagues, liveOnly } = fields
  return {
    hiddenLeagues: Array.isArray(hiddenLeagues)
      ? hiddenLeagues.filter((league): league is string => typeof league === 'string')
      : firstVisitSettings.hiddenLeagues,
    liveOnly: typeof liveOnly === 'boolean' ? liveOnly : firstVisitSettings.liveOnly,
  }
}
