/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// The ASP.NET Core server's dev URL (server/src/ScoreMap.Server/Properties/launchSettings.json).
const server = 'http://localhost:5147'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/hubs': { target: server, ws: true },
    },
  },
  test: {
    environment: 'node',
  },
})
