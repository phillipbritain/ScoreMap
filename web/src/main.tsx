import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// The built-in theme's font for every text on the page, bundled with the app (the globe's comes from
// the map's font server, ADR-0006).
import '@fontsource-variable/open-sans'
import './index.css'
import App from './App.tsx'
import { isDemo } from './demo/demo'
import { builtInTheme } from './theme/builtInTheme'
import builtInJson from './theme/builtInTheme.json'
import { resolveTheme } from './theme/theme'
import { loadDraft, type ThemeJson } from './themeTuner/themeDraft'

// A demo (ADR-0019), opened by its link: read once, as the page opens.
const demo = isDemo(window.location.search)

// On a local run, the theme tuner's draft saved in this browser, if it still resolves (see ThemeTuner).
// Not in a demo, which looks as the live one does.
const tuning = import.meta.env.DEV && !demo ? tunerStart(builtInJson as unknown as ThemeJson) : undefined

function tunerStart(builtIn: ThemeJson) {
  const draft = loadDraft(window.localStorage, builtIn)
  const resolved = draft && resolveTheme(draft)
  return resolved?.ok ? { builtIn, initial: draft!, theme: resolved.theme } : { builtIn, initial: builtIn, theme: builtInTheme }
}

// The one place the theme is chosen to start in. The app writes it to the page for its CSS and hands
// it to the globe, and the same way any change of theme after (see useTheme).
const theme = tuning?.theme ?? builtInTheme

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App theme={theme} tuning={tuning} demo={demo} />
  </StrictMode>,
)
