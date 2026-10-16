import settings from './asleepSettings.json'

/** When ScoreMap falls asleep (see GLOSSARY.md), from asleepSettings.json. */
export interface AsleepSettings {
  /** The idle timeout: how long the page can be hidden before ScoreMap falls asleep, in minutes. */
  idleTimeoutMinutes: number
}

/** The app's own asleep settings, from asleepSettings.json. */
export const asleepSettings: AsleepSettings = settings

/** The page's visibility, as the browser reports it: `document` has it. */
export interface PageVisibility {
  readonly hidden: boolean
  addEventListener(type: 'visibilitychange', listener: () => void): void
  removeEventListener(type: 'visibilitychange', listener: () => void): void
}

/**
 * Watches the page for ScoreMap falling asleep: once it has been hidden (its window minimised, another
 * tab in front, the screen locked) for the idle timeout, onSleep is called, and when it's shown again
 * after that, onWake. Shown again sooner, nothing happens. The countdown runs from the start if the page
 * opens hidden, as a link opened in a background tab does. Returns a function that stops watching.
 */
export function watchForSleep(
  page: PageVisibility,
  idleTimeoutMs: number,
  { onSleep, onWake }: { onSleep: () => void; onWake: () => void },
): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined
  let asleep = false

  const changed = () => {
    if (page.hidden) {
      if (!asleep && timer === undefined)
        timer = setTimeout(() => {
          timer = undefined
          asleep = true
          onSleep()
        }, idleTimeoutMs)
      return
    }
    clearTimeout(timer)
    timer = undefined
    if (asleep) {
      asleep = false
      onWake()
    }
  }

  page.addEventListener('visibilitychange', changed)
  changed()
  return () => {
    page.removeEventListener('visibilitychange', changed)
    clearTimeout(timer)
  }
}
