// Serves the base's browser app for the looks-same check, as `npm run dev` would with its own
// vite.config.ts, against the server in SERVER_HTTP. Its packages may be the working tree's,
// linked, so it keeps its Vite cache to itself and may serve files from outside its folder.
//
//   node serveBase.ts <base web folder> <port>
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const [web, port] = process.argv.slice(2)
const vite: typeof import('vite') = await import(pathToFileURL(join(web, 'node_modules/vite/dist/node/index.js')).href)
const server = await vite.createServer({
  root: web,
  cacheDir: join(web, '.looks-same-vite'),
  logLevel: 'warn',
  server: { port: Number(port), strictPort: true, fs: { strict: false } },
})
await server.listen()
console.log(`Serving the base on ${server.resolvedUrls?.local[0]}`)
