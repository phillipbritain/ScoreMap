// Checks whether the working tree looks the same as a base: a screenshot of crowded over London,
// and every computed CSS declaration, on both, in one paused dev run. See the
// run-scoremap skill.
//
//   npm run looks-same -- <base ref> [--out <folder>]     (in web/)
//
// Exits 0 when nothing differs (a screenshot it can't make repeatable is said so, not counted), 1
// when something does, 2 when the check itself fails.
import { spawn, spawnSync, type ChildProcess } from 'node:child_process'
import { closeSync, mkdirSync, mkdtempSync, openSync, readFileSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { checkOutBase, type BaseCheckout } from './baseCheckout.ts'
import { cssChanges, type CssChange } from './cssChanges.ts'
import { readCssDeclarations, type CssDeclaration } from './cssDeclarations.ts'
import { pageStep, type Camera, type PageAnswer, type PageStep } from './page.ts'
import { compareScreenshots } from './screenshotDiff.ts'

const repo = resolve(import.meta.dirname, '../../..')
const scratch = mkdtempSync(join(tmpdir(), 'scoremap-looks-same-'))
const session = `scoremap-looks-same-${process.pid}`

/**
 * Runs a command to the end and gives its standard output. The output goes through files, not
 * pipes: a daemon the command starts would hold a pipe open forever.
 */
function run(command: string, args: string[], { cwd = repo, input, shell = false }: { cwd?: string; input?: string; shell?: boolean } = {}): string {
  const [outFile, errFile] = [join(scratch, 'command.out'), join(scratch, 'command.err')]
  const out = openSync(outFile, 'w')
  const err = openSync(errFile, 'w')
  let result
  try {
    const stdio = [input === undefined ? 'ignore' : 'pipe', out, err] as const
    const quote = (arg: string) => (/[\s"&|<>^()%!]/.test(arg) ? `"${arg.replaceAll('"', '""')}"` : arg)
    result = shell
      ? spawnSync([command, ...args].map(quote).join(' '), { cwd, input, shell: true, stdio: [...stdio] })
      : spawnSync(command, args, { cwd, input, stdio: [...stdio] })
  } finally {
    closeSync(out)
    closeSync(err)
  }
  const text = readFileSync(outFile, 'utf8')
  if (result.error) throw new Error(`${command} ${args[0]}: ${result.error.message}`)
  if (result.status !== 0) throw new Error(`${command} ${args.join(' ')} failed:\n${(text + readFileSync(errFile, 'utf8')).trim()}`)
  return text
}

// agent-browser is an npm script on Windows (agent-browser.cmd), which only the shell can start.
const browser = (...args: string[]) => run('agent-browser', ['--session', session, ...args], { shell: true })

/** Runs a step of the check in the page, again while it's waiting (up to two minutes), giving back its answer. */
function inPage(step: PageStep): PageAnswer {
  const end = Date.now() + 120_000
  for (;;) {
    const answer = evaluate(`(${pageStep.toString()})(${JSON.stringify(step)})`) as PageAnswer
    if (!('waiting' in answer)) return answer
    if (Date.now() > end) throw new Error(`Timed out waiting for ${answer.waiting}`)
  }
}

function evaluate(script: string): unknown {
  const answer = JSON.parse(run('agent-browser', ['--session', session, 'eval', '--stdin', '--json'], { shell: true, input: script }))
  return answer.data.result
}

/**
 * A fresh page of the app at `url`, its saved settings cleared (see the run-scoremap skill), opening
 * on the camera given. Opening there, rather than turning there, loads only the view's map tiles:
 * tiles left over from the view the globe opens on can change which place names show.
 */
function openApp(url: string, [width, height]: [number, number], { center: [longitude, latitude], zoom }: Camera): void {
  browser('set', 'viewport', String(width), String(height))
  browser('open', `${url}/favicon.svg`)
  const camera = JSON.stringify({ longitude, latitude, zoom })
  evaluate(`localStorage.clear(); localStorage.setItem('scoremap.camera', ${JSON.stringify(camera)})`)
  browser('open', url)
}

async function freePort(): Promise<number> {
  return new Promise((done, fail) => {
    const server = createServer().listen(0, () => {
      const { port } = server.address() as { port: number }
      server.close(() => done(port))
    })
    server.on('error', fail)
  })
}

async function until(ready: () => Promise<boolean>, what: string, ms = 120_000): Promise<void> {
  const end = Date.now() + ms
  while (!(await ready().catch(() => false))) {
    if (Date.now() > end) throw new Error(`Timed out waiting for ${what}`)
    await new Promise((done) => setTimeout(done, 500))
  }
}

interface Run {
  web: string
  server: string
}

/** Starts this clone's dev run (isolated if any other is going), and gives its URLs. */
function startRun(): Run {
  const others = JSON.parse(run('aspire', ['ps', '--format', 'json', '--nologo'])) as unknown[]
  console.log('Starting the dev run…')
  run('aspire', ['start', '--nologo', '--non-interactive', ...(others.length ? ['--isolated'] : [])])
  run('aspire', ['wait', 'web', '--nologo'])
  const { resources } = JSON.parse(run('aspire', ['describe', '--format', 'json', '--nologo'])) as {
    resources: { displayName: string; urls: { name: string; url: string }[] }[]
  }
  const urls = (name: string) => resources.find((resource) => resource.displayName === name)?.urls ?? []
  const web = urls('web')[0]?.url
  const server = urls('server').find((url) => url.name === 'http')?.url
  if (!web || !server) throw new Error(`Couldn't find the run's URLs in aspire describe`)
  return { web: web.replace(/\/$/, ''), server: server.replace(/\/$/, '') }
}

/**
 * Starts the scenario afresh, Paused, in one switch: its games stand still as they start, so every
 * page shows the same ones.
 */
async function startPaused(server: string, scenario: string): Promise<void> {
  const switched = await fetch(`${server}/api/scenarios/running`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: scenario, speed: 'Paused' }),
  })
  if (!switched.ok) throw new Error(`Couldn't start ${scenario} paused: ${await switched.text()}`)
}

/** Serves the base's browser app against the run's server, and gives its URL. */
async function serveBase(base: BaseCheckout, server: string): Promise<{ url: string; vite: ChildProcess }> {
  const port = await freePort()
  const env: NodeJS.ProcessEnv = { ...process.env, SERVER_HTTP: server }
  delete env.SERVER_HTTPS
  const log = openSync(join(scratch, 'base-vite.log'), 'w')
  const vite = spawn(process.execPath, [join(import.meta.dirname, 'serveBase.ts'), base.web, String(port)], {
    cwd: base.web,
    env,
    stdio: ['ignore', log, log],
  })
  const url = `http://localhost:${port}`
  await until(async () => (await fetch(url)).ok, 'the base to be served')
  return { url, vite }
}

// The one view screenshotted: crowded's games in London, Live and Upcoming score cards packed close
// enough that some move aside, with trails back to their venues.
const scenario = 'crowded'
const camera: Camera = { center: [-0.1276, 51.5072], zoom: 9 }
const viewport: [number, number] = [1280, 800]

/** Screenshots the view of the app at `url` from a fresh page, and gives the page's CSS too if asked. */
function capture(url: string, games: number, file: string, { css = false } = {}): CssDeclaration[] | undefined {
  openApp(url, viewport, camera)
  inPage({ step: 'show', games, camera })
  inPage({ step: 'freeze' })
  browser('screenshot', file)
  return css ? (evaluate(`(${readCssDeclarations.toString()})()`) as CssDeclaration[]) : undefined
}

type Verdict =
  | { result: 'same' }
  | { result: 'differs'; pixels: number; diff: string; sizes?: [string, string] }
  | { result: 'unrepeatable'; side: 'working tree' | 'base'; pixels: number; diff: string }

/**
 * Compares the screenshots of the base and the working tree. Where they differ, screenshots each
 * again: if either's two differ, the globe drew differently from one page to the next, and the
 * difference between them can't be told from that; if neither's do, the change made it.
 */
function compareSides(games: number, urls: { work: string; base: string }, out: string): Verdict {
  const shot = (side: 'work' | 'base', n: number) => join(out, `${side}${n}.png`)
  const first = compareScreenshots(readFileSync(shot('base', 1)), readFileSync(shot('work', 1)))
  if (!first.differing) return { result: 'same' }

  console.log('The screenshots differ; taking them again to rule out the globe drawing differently…')
  for (const side of ['work', 'base'] as const) {
    capture(urls[side], games, shot(side, 2))
    const again = compareScreenshots(readFileSync(shot(side, 1)), readFileSync(shot(side, 2)))
    if (again.differing) {
      const diff = join(out, `${side}-unrepeatable.png`)
      writeFileSync(diff, again.diff)
      return { result: 'unrepeatable', side: side === 'work' ? 'working tree' : 'base', pixels: again.differing, diff }
    }
  }
  const diff = join(out, 'diff.png')
  writeFileSync(diff, first.diff)
  return { result: 'differs', pixels: first.differing, diff, sizes: first.sizes }
}

function describeVerdict(verdict: Verdict): string {
  switch (verdict.result) {
    case 'same':
      return 'Screenshot: the same'
    case 'differs':
      return `Screenshot: DIFFERS by ${verdict.pixels.toLocaleString()} pixels${verdict.sizes ? ` (${verdict.sizes.join(' on the base, ')} on the working tree)` : ''}; diff ${verdict.diff}`
    case 'unrepeatable':
      return `Screenshot: can't be made repeatable, so it isn't compared: two screenshots of the ${verdict.side} differ by ${verdict.pixels.toLocaleString()} pixels; ${verdict.diff}`
  }
}

function describeChange({ rule, property, base, work }: CssChange): string {
  return `  ${rule}  ${property}: ${base ?? '(none)'} → ${work ?? '(none)'}`
}

async function main(args: string[]): Promise<number> {
  const outAt = args.indexOf('--out')
  const outFolder = outAt >= 0 ? args.splice(outAt, 2)[1] : undefined
  const [baseRef] = args
  if (!baseRef || args.length > 1) {
    console.error('Usage: npm run looks-same -- <base ref> [--out <folder>]   (in web/)')
    return 2
  }
  const out = resolve(outFolder ?? join(tmpdir(), 'scoremap-looks-same', new Date().toISOString().replace(/[:.]/g, '-')))
  mkdirSync(out, { recursive: true })

  // Undone in reverse, however the check ends.
  const cleanUp: (() => void)[] = []
  const stopOnInterrupt = () => {
    tidy()
    process.exit(2)
  }
  const tidy = () => {
    for (const step of cleanUp.splice(0).reverse()) {
      try {
        step()
      } catch (error) {
        console.error(`While tidying up: ${(error as Error).message}`)
      }
    }
  }
  process.once('SIGINT', stopOnInterrupt)
  try {
    console.log(`Checking out ${baseRef}…`)
    const base = checkOutBase(repo, baseRef)
    cleanUp.push(() => base.remove())

    cleanUp.push(() => {
      console.log('Stopping the dev run…')
      run('aspire', ['stop', '--nologo'])
    })
    const { web, server } = startRun()
    await startPaused(server, scenario)

    const { url: baseUrl, vite } = await serveBase(base, server)
    cleanUp.push(() => vite.kill())

    cleanUp.push(() => browser('close'))
    browser('open', 'about:blank')

    // The first page to show the view fetches its map tiles, and tiles fetched afresh come in a
    // different order from ones the browser has, which moves a few place names: so this page,
    // which waits for the games, isn't screenshotted.
    openApp(web, viewport, camera)
    const { games } = inPage({ step: 'games' }) as { games: number }
    console.log(`Screenshotting ${games} games on ${scenario}, paused at its start…`)

    const urls = { work: web, base: baseUrl }
    const workCss = capture(web, games, join(out, 'work1.png'), { css: true })!
    const baseCss = capture(baseUrl, games, join(out, 'base1.png'), { css: true })!
    const verdict = compareSides(games, urls, out)
    const changes = cssChanges(baseCss, workCss)
    writeFileSync(join(out, 'css-changes.txt'), changes.map(describeChange).join('\n') + '\n')

    console.log(`\n${baseRef} (${base.commit.slice(0, 7)}) against the working tree\n`)
    console.log(describeVerdict(verdict))
    console.log(changes.length ? `Computed CSS: ${changes.length} declarations differ` : 'Computed CSS: the same')
    for (const change of changes) console.log(describeChange(change))
    console.log(`\nScreenshots and diffs are in ${out}`)
    return verdict.result === 'differs' || changes.length ? 1 : 0
  } finally {
    tidy()
    process.off('SIGINT', stopOnInterrupt)
  }
}

main(process.argv.slice(2)).then(
  (code) => process.exit(code),
  (error: Error) => {
    console.error(`\nThe check failed: ${error.message}`)
    process.exit(2)
  },
)
