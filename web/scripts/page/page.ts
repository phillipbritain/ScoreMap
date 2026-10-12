// Drives the dev run's page open in agent-browser, for what would otherwise take an `eval`: resets
// it to the start view, waits for it to be ready or settled, reads a value from it, screenshots it,
// pans it for a card trace. See the run-scoremap skill and docs/agents/card-layout-replay.md.
//
//   npm run page -- reset <web URL>                 (in web/)
//   npm run page -- ready
//   npm run page -- settled
//   npm run page -- read <selector> [property]     textContent unless given; rect for the bounding box
//   npm run page -- screenshot <file>              once ready and settled
//   npm run page -- pan <file> [--center <lng>,<lat>] [--zoom <zoom>] [--by <x>,<y>,<frames>]...
//                                                  saves the frames the cards were laid out from
//
// It uses agent-browser's session from AGENT_BROWSER_SESSION, as agent-browser itself does. Exits 0
// when done, 1 when the page doesn't do as asked (nothing matches the selector, or the wait times
// out), 2 when it's used wrongly or a command fails.
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { agentBrowser, TimedOut } from '../agentBrowser.ts'
import { panArgs } from './panArgs.ts'
import { pageCheck, type PageCheck } from './pageCheck.ts'
import { panGlobe } from './panGlobe.ts'

const usage = 'Usage: npm run page -- reset <web URL> | ready | settled | read <selector> [property] | screenshot <file> | pan <file> [--center <lng>,<lat>] [--zoom <zoom>] [--by <x>,<y>,<frames>]...'
const scratch = mkdtempSync(join(tmpdir(), 'scoremap-page-'))

const page = agentBrowser({ cwd: process.cwd(), scratch })
const { browser, evaluate } = page
const inPage = (check: PageCheck) => page.inPage(pageCheck, check)

class Failed extends Error {}

function main([command, ...args]: string[]): void {
  const panning = command === 'pan' ? panArgs(args) : null
  if (command === 'reset' && args.length === 1) {
    // The app writes its saved camera back as it leaves, so storage is cleared from a page that isn't the app.
    const url = args[0].replace(/\/$/, '')
    browser(['open', `${url}/favicon.svg`])
    evaluate('localStorage.clear()')
    browser(['open', url])
    console.log(`Reset ${url} to the start view`)
  } else if (command === 'ready' && args.length === 0) {
    inPage({ check: 'ready' })
    console.log('Ready')
  } else if (command === 'settled' && args.length === 0) {
    inPage({ check: 'settled' })
    console.log('Settled')
  } else if (command === 'read' && (args.length === 1 || args.length === 2)) {
    const answer = inPage({ check: 'read', selector: args[0], property: args[1] })
    if ('missing' in answer) throw new Failed(`Nothing matches ${answer.missing}`)
    const { value } = answer as { value: unknown }
    console.log(typeof value === 'string' ? value : JSON.stringify(value))
  } else if (command === 'screenshot' && args.length === 1) {
    inPage({ check: 'ready' })
    inPage({ check: 'settled' })
    const file = resolve(args[0])
    browser(['screenshot', file])
    console.log(`Screenshot saved to ${file}`)
  } else if (panning) {
    const { file, pan } = panning
    const { frames } = page.inPage(panGlobe, pan)
    writeFileSync(resolve(file), JSON.stringify(frames))
    console.log(`${frames.length} frames saved to ${resolve(file)}`)
  } else {
    console.error(usage)
    process.exitCode = 2
  }
}

try {
  main(process.argv.slice(2))
} catch (error) {
  console.error((error as Error).message)
  process.exitCode = error instanceof Failed || error instanceof TimedOut ? 1 : 2
} finally {
  // The browser daemon, if this started it, may still hold the output files.
  try {
    rmSync(scratch, { recursive: true, force: true })
  } catch {}
}
