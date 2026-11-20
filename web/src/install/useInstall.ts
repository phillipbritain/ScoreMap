import { useSyncExternalStore } from 'react'
import { installPrompts, installWay, isIos, type InstallWay } from './install'

// Listening from when the app's code loads, as the browser may offer before the app first renders.
const prompts = installPrompts(window)

/** Whether ScoreMap runs as the installed app: standalone, or added to an iOS Home Screen. */
function runningInstalled(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true
}

/** How ScoreMap can be installed here (see installWay), and Install app's action for the browser's way. */
export function useInstall(): { way: InstallWay | null; prompt: () => void } {
  const canPrompt = useSyncExternalStore(prompts.subscribe, prompts.canPrompt)
  const way = installWay({ installed: runningInstalled(), ios: isIos(navigator.userAgent, navigator.maxTouchPoints), canPrompt })
  return { way, prompt: prompts.prompt }
}
