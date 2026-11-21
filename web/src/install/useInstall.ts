import { useSyncExternalStore } from 'react'
import { installPrompts, offersInstall } from './install'

// Listening from when the app's code loads, as the browser may offer before the app first renders.
const prompts = installPrompts(window)

/** Whether ScoreMap runs as the installed app: standalone, or added to an iOS Home Screen. */
function runningInstalled(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true
}

/** More's Install app: the browser's own install dialog, where the browser has offered one (see offersInstall); else none. */
export function useInstall(): (() => void) | undefined {
  const canPrompt = useSyncExternalStore(prompts.subscribe, prompts.canPrompt)
  return offersInstall({ installed: runningInstalled(), canPrompt }) ? prompts.prompt : undefined
}
