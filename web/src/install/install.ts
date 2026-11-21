/**
 * Installing ScoreMap as an app (see manifest.webmanifest, ADR-0030). A browser that can install it
 * itself (Chromium) says so with `beforeinstallprompt`, and More's Install app asks it to, opening the
 * browser's own install dialog. Elsewhere (iOS, by Share then Add to Home Screen) the browser's own way
 * is left to the viewer; ScoreMap shows nothing. Nothing shows once ScoreMap runs as the installed app.
 */

export interface InstallPlace {
  /** Whether ScoreMap is running as the installed app (display-mode standalone). */
  installed: boolean
  /** Whether the browser has offered to install ScoreMap (a `beforeinstallprompt` kept for later). */
  canPrompt: boolean
}

/** Whether More offers Install app: where the browser has offered to install, outside the installed app. */
export function offersInstall({ installed, canPrompt }: InstallPlace): boolean {
  return !installed && canPrompt
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
