/// <reference types="vitest/config" />
import { playwright } from '@vitest/browser-playwright'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// The ASP.NET Core server's dev URL (server/src/ScoreMap.Server/Properties/launchSettings.json).
const server = 'http://localhost:5147'

// Tests that need a real browser, with WebGL for MapLibre (ADR-0008).
const browserTests = 'src/**/*.browser.test.ts'

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
          },
        },
      },
    ],
  },
})
