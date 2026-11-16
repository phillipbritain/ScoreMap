import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// The built-in theme's font for every text on the page, bundled with the app (the globe's comes from
// the map's font server, ADR-0006).
import '@fontsource-variable/open-sans'
import './index.css'
import App from './App.tsx'
import { isDemo } from './demo/demo'
import { builtInTheme } from './theme/builtInTheme'

// A demo (ADR-0019), opened by its link: read once, as the page opens.
const demo = isDemo(window.location.search)

// The one place the theme is chosen to start in. The app writes it to the page for its CSS and hands
// it to the globe, and the same way any change of theme after (see useTheme).
const theme = builtInTheme

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App theme={theme} demo={demo} />
  </StrictMode>,
)
