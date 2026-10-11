import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// The built-in theme's font for every text on the page, bundled with the app (the globe's comes from
// the map's font server, ADR-0006).
import '@fontsource-variable/open-sans'
import './index.css'
import App from './App.tsx'
import { applyTheme } from './theme/applyTheme'
import { builtInTheme } from './theme/builtInTheme'

applyTheme(document.documentElement, builtInTheme)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
