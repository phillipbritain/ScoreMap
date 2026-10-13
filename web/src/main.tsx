import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// The built-in theme's font for every text on the page, bundled with the app (the globe's comes from
// the map's font server, ADR-0006).
import '@fontsource-variable/open-sans'
import './index.css'
import App from './App.tsx'
import { applyTheme } from './theme/applyTheme'
import { builtInTheme } from './theme/builtInTheme'
import builtInJson from './theme/builtInTheme.json'
import { resolveTheme } from './theme/theme'
import { loadDraft, type ThemeJson } from './themeTuner/themeDraft'

// On a local run, the theme tuner's draft saved in this browser, if it still resolves (see ThemeTuner).
const tuning = import.meta.env.DEV ? tunerStart(builtInJson as unknown as ThemeJson) : undefined

function tunerStart(builtIn: ThemeJson) {
  const draft = loadDraft(window.localStorage, builtIn)
  const resolved = draft && resolveTheme(draft)
  return resolved?.ok ? { builtIn, initial: draft!, theme: resolved.theme } : { builtIn, initial: builtIn, theme: builtInTheme }
}

// The one place the theme is chosen: written to the page for its CSS, and handed to the globe. On a
// local run the theme tuner can change it from there.
const theme = tuning?.theme ?? builtInTheme
applyTheme(document.documentElement, theme)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App theme={theme} tuning={tuning} />
  </StrictMode>,
)
