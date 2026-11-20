/**
 * Installing ScoreMap as an app (see manifest.webmanifest). A browser that can install it itself
 * (Chromium) says so with `beforeinstallprompt`, and More's Install app asks it to; iOS can't be asked,
 * so there the iOS install hint tells the viewer how (Share, then Add to Home Screen). Neither shows
 * once ScoreMap runs as the installed app.
 */

/** How ScoreMap can be installed here: by asking the browser, by the iOS install hint's steps, or not at all. */
export type InstallWay = 'prompt' | 'iosSteps'

export interface InstallPlace {
  /** Whether ScoreMap is running as the installed app (display-mode standalone). */
  installed: boolean
  /** Whether this is an iPhone, iPad or iPod, whose browsers install only by Share → Add to Home Screen. */
  ios: boolean
  /** Whether the browser has offered to install ScoreMap (a `beforeinstallprompt` kept for later). */
  canPrompt: boolean
}

export function installWay({ installed, ios, canPrompt }: InstallPlace): InstallWay | null {
  if (installed) return null
  if (canPrompt) return 'prompt'
  return ios ? 'iosSteps' : null
}

/**
 * Whether this is iOS, from the browser's user agent: an iPhone, iPad or iPod, or an iPad asking for
 * desktop sites, which calls itself a Mac but has a touch screen (no Mac has).
 */
export function isIos(userAgent: string, maxTouchPoints: number): boolean {
  return /iPhone|iPad|iPod/.test(userAgent) || (/Macintosh/.test(userAgent) && maxTouchPoints > 1)
}

export interface IosHintState {
  way: InstallWay | null
  /** Whether the globe has been revealed (not under the loading screen). */
  revealed: boolean
  /** Whether the welcome tour shows, which the hint never covers. */
  touring: boolean
  /** Whether the viewer closed the hint before. */
  dismissed: boolean
  /** Whether the viewer asked for it from More's Install app. */
  asked: boolean
}

/**
 * Whether the iOS install hint shows: on iOS, outside the installed app, once the welcome tour is
 * finished or skipped; once only, until the viewer closes it, or again when they ask from More.
 */
export function showsIosHint({ way, revealed, touring, dismissed, asked }: IosHintState): boolean {
  return way === 'iosSteps' && revealed && !touring && (asked || !dismissed)
}

/** The part of the browser's localStorage the hint's store uses. */
export type HintStorage = Pick<Storage, 'getItem' | 'setItem'>

const hintKey = 'scoremap.iosInstallHintClosed'

/**
 * Remembers that the viewer closed the iOS install hint. Storage is reached through a function, as
 * reading `window.localStorage` can throw; with no storage the hint is never remembered as closed.
 */
export function installHintStore(storage: () => HintStorage) {
  return {
    dismissed(): boolean {
      try {
        return storage().getItem(hintKey) === 'true'
      } catch {
        return false
      }
    },
    dismiss() {
      try {
        storage().setItem(hintKey, 'true')
      } catch {
        // The hint will just show again next visit.
      }
    },
  }
}

/** Chromium's `beforeinstallprompt` event, kept to install ScoreMap when the viewer asks. */
export interface InstallPromptEvent extends Event {
  prompt(): Promise<unknown>
}

/**
 * Keeps the browser's offer to install ScoreMap (`beforeinstallprompt`) from the moment the page
 * loads, holding back the browser's own banner, so Install app can use it. The offer goes once used,
 * as a prompt can be shown only once, and once ScoreMap is installed (`appinstalled`).
 */
export function installPrompts(target: EventTarget) {
  let offer: InstallPromptEvent | null = null
  const listeners = new Set<() => void>()
  const set = (next: InstallPromptEvent | null) => {
    offer = next
    listeners.forEach((listener) => listener())
  }
  target.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault()
    set(event as InstallPromptEvent)
  })
  target.addEventListener('appinstalled', () => set(null))
  return {
    canPrompt: () => offer !== null,
    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    /** Shows the browser's install dialog, if it has offered one. */
    prompt() {
      const used = offer
      set(null)
      void used?.prompt()
    },
  }
}
