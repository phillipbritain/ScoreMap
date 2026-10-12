/// <reference types="vitest/config" />
import { writeFile } from 'node:fs/promises'
import { playwright } from '@vitest/browser-playwright'
import type { BrowserCommand } from 'vitest/node'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// The server's URL, which Aspire passes to Vite on a local run (ADR-0013); a bare `npm run dev`
// has none, so nothing reaches the server.
const server = process.env.SERVER_HTTPS || process.env.SERVER_HTTP

// Tests that need a real browser, with WebGL for MapLibre (ADR-0008).
const browserTests = '{src,scripts}/**/*.browser.test.ts'

/** Turns the device's reduce motion setting on or off for the test page (see motion.browser.test.ts). */
const reduceMotion: BrowserCommand<[reduce: boolean]> = async ({ page }, reduce) => {
  await page.emulateMedia({ reducedMotion: reduce ? 'reduce' : 'no-preference' })
}

/** Where CARD_TRACE says to save a captured card trace, if anywhere (see captureCardTrace.browser.test.ts). */
const cardTracePath: BrowserCommand<[]> = async () => process.env.CARD_TRACE || null

/** Saves a captured card trace to CARD_TRACE, which may be outside the project, as a scratch file should be. */
const saveCardTrace: BrowserCommand<[json: string]> = async (_, json) => {
  await writeFile(process.env.CARD_TRACE!, json)
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/hubs': { target: server, ws: true },
      '/api': { target: server },
    },
  },
  test: {
    projects: [
      // `npm test`: everything else, quickly, in Node.
      {
        extends: true,
        test: { name: 'unit', environment: 'node', exclude: [browserTests, '**/node_modules/**'] },
      },
      // `npm run test:browser`: the globe map, in headless Chromium.
      {
        extends: true,
        test: {
          name: 'browser',
          include: [browserTests],
          browser: {
            enabled: true,
            provider: playwright(),
            headless: true,
            // Room for the tests' 800 × 600 globe.
            viewport: { width: 1024, height: 768 },
            instances: [{ browser: 'chromium' }],
            commands: { reduceMotion, cardTracePath, saveCardTrace },
          },
        },
      },
    ],
  },
})
