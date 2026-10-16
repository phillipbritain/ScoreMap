import { cityLabelSettings, type CityLabelSettings } from '../globe/cityLabels'
import { zoomSettings, type ZoomSettings } from '../globe/zoomLevels'
import { asleepSettings, type AsleepSettings } from '../live/asleep'

/** How the app behaves, apart from its look: what the behaviour tuner changes on a local run. */
export interface Behaviour {
  cityLabels: CityLabelSettings
  zoom: ZoomSettings
  asleep: AsleepSettings
}

/** The app's own behaviour, from the settings files it's made from. */
export const builtInBehaviour: Behaviour = { cityLabels: cityLabelSettings, zoom: zoomSettings, asleep: asleepSettings }

/** What the behaviour tuner can draw on the globe to show a setting at work: each off until ticked, and not saved. */
export interface Overlays {
  /** Each game ringed at the reach its city label may be within. */
  gameCityReach: boolean
}

export const noOverlays: Overlays = { gameCityReach: false }

const storageKey = 'scoremap.behaviourDraft'

/**
 * The behaviour tuner's draft saved in this browser, if it was made from this built-in behaviour;
 * otherwise the built-in behaviour, so a change to the settings files isn't hidden by an old draft.
 */
export function loadBehaviour(storage: Pick<Storage, 'getItem'>, builtIn: Behaviour = builtInBehaviour): Behaviour {
  try {
    const saved = JSON.parse(storage.getItem(storageKey) ?? 'null') as { builtIn: Behaviour; draft: Behaviour } | null
    return saved && JSON.stringify(saved.builtIn) === JSON.stringify(builtIn) ? saved.draft : builtIn
  } catch {
    return builtIn
  }
}

/** Saves the draft in this browser, or forgets it when it's the built-in behaviour. */
export function saveBehaviour(storage: Pick<Storage, 'setItem' | 'removeItem'>, draft: Behaviour, builtIn: Behaviour = builtInBehaviour): void {
  try {
    if (JSON.stringify(draft) === JSON.stringify(builtIn)) storage.removeItem(storageKey)
    else storage.setItem(storageKey, JSON.stringify({ builtIn, draft }))
  } catch {
    // The draft just won't outlast this page.
  }
}
