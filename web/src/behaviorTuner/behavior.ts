import { cityLabelSettings, type CityLabelSettings } from '../globe/cityLabels'
import { zoomSettings, type ZoomSettings } from '../globe/zoomLevels'
import { asleepSettings, type AsleepSettings } from '../live/asleep'

/** How the app behaves, apart from its look: what the behavior tuner changes on a local run. */
export interface Behavior {
  cityLabels: CityLabelSettings
  zoom: ZoomSettings
  asleep: AsleepSettings
}

/** The app's own behavior, from the settings files it's made from. */
export const builtInBehavior: Behavior = { cityLabels: cityLabelSettings, zoom: zoomSettings, asleep: asleepSettings }

/** What the behavior tuner can draw on the globe to show a setting at work: each off until ticked, and not saved. */
export interface Overlays {
  /** Each game ringed at the reach its city label may be within. */
  gameCityReach: boolean
}

export const noOverlays: Overlays = { gameCityReach: false }

const storageKey = 'scoremap.behaviorDraft'
// Where the draft was saved before the project switched to American spelling; read when there's none under storageKey.
const oldStorageKey = 'scoremap.behaviourDraft'

/**
 * The behavior tuner's draft saved in this browser, if it was made from this built-in behavior;
 * otherwise the built-in behavior, so a change to the settings files isn't hidden by an old draft.
 */
export function loadBehavior(storage: Pick<Storage, 'getItem'>, builtIn: Behavior = builtInBehavior): Behavior {
  try {
    const saved = JSON.parse(storage.getItem(storageKey) ?? storage.getItem(oldStorageKey) ?? 'null') as { builtIn: Behavior; draft: Behavior } | null
    return saved && JSON.stringify(saved.builtIn) === JSON.stringify(builtIn) ? saved.draft : builtIn
  } catch {
    return builtIn
  }
}

/** Saves the draft in this browser, or forgets it when it's the built-in behavior. */
export function saveBehavior(storage: Pick<Storage, 'setItem' | 'removeItem'>, draft: Behavior, builtIn: Behavior = builtInBehavior): void {
  try {
    storage.removeItem(oldStorageKey)
    if (JSON.stringify(draft) === JSON.stringify(builtIn)) storage.removeItem(storageKey)
    else storage.setItem(storageKey, JSON.stringify({ builtIn, draft }))
  } catch {
    // The draft just won't outlast this page.
  }
}
