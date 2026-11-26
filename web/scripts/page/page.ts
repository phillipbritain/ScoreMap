// Drives the dev run's page open in agent-browser, for what would otherwise take an `eval`: resets
// it to the start view, waits for it to be ready or settled, turns its camera, reads a value from it, screenshots it,
// pans it for a card trace, touches it as a finger does. See docs/browser-automation.md and docs/agents/card-layout-replay.md.
//
//   npm run page -- reset <web URL> [--toured]      (in web/) --toured: with the welcome tour finished
//   npm run page -- ready
//   npm run page -- settled
//   npm run page -- camera <lng>,<lat> <zoom>      turns the camera there and waits for the globe to be still
//   npm run page -- read <selector> [property]     textContent unless given; rect for the bounding box
//   npm run page -- screenshot <file>              once ready and settled
//   npm run page -- score | finish                 a Live game on screen scores or finishes, in this tab only
//   npm run page -- pan <file> [--center <lng>,<lat>] [--zoom <zoom>] [--by <x>,<y>,<frames>]...
//                                                  saves the frames the cards were laid out from
//   npm run page -- tap <selector|x y>             a real touch tap, on the middle of the selector's first match or at the point
//   npm run page -- swipe <selector|x y> <dx> <dy> [ms]
//                                                  a real touch swipe from there by (dx, dy) px at a steady speed, over ms (500)
//
// It uses agent-browser's session from AGENT_BROWSER_SESSION, as agent-browser itself does. Exits 0
// when done, 1 when the page doesn't do as asked (nothing matches the selector, or the wait times
// out), 2 when it's used wrongly or a command fails.
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { agentBrowser, TimedOut } from '../agentBrowser.ts'
import { finishedTour } from './finishedTour.ts'
import { panArgs } from './panArgs.ts'
import { pageCheck, type PageCheck } from './pageCheck.ts'
import { panGlobe } from './panGlobe.ts'
import { resetUrls } from './resetUrls.ts'
import { touchPage } from './touch.ts'
import { touchArgs, type Touch } from './touchArgs.ts'

const usage = 'Usage: npm run page -- reset <web URL> [--toured] | ready | settled | camera <lng>,<lat> <zoom> | read <selector> [property] | screenshot <file> | score | finish | pan <file> [--center <lng>,<lat>] [--zoom <zoom>] [--by <x>,<y>,<frames>]... | tap <selector|x y> | swipe <selector|x y> <dx> <dy> [ms]'
const scratch = mkdtempSync(join(tmpdir(), 'scoremap-page-'))

const page = agentBrowser({ cwd: process.cwd(), scratch })
const { browser, evaluate } = page
const inPage = (check: PageCheck) => page.inPage(pageCheck, check)

class Failed extends Error {}

async function main([command, ...args]: string[]): Promise<void> {
  const panRequest = command === 'pan' ? panArgs(args) : null
  const touchRequest = command === 'tap' || command === 'swipe' ? touchArgs(command, args) : null
  if (command === 'reset' && (args.length === 1 || (args.length === 2 && args[1] === '--toured'))) {
    // The app writes its saved camera back as it leaves, so storage is cleared from a page that isn't the app.
    const { clear, open: url } = resetUrls(args[0])
    const toured = args.length === 2
    browser(['open', clear])
    evaluate('localStorage.clear()')
    if (toured) evaluate(`localStorage.setItem(${JSON.stringify(finishedTour.key)}, ${JSON.stringify(finishedTour.value)})`)
    browser(['open', url])
    console.log(`Reset ${url} to the start view${toured ? ', with the welcome tour finished' : ''}`)
  } else if (command === 'ready' && args.length === 0) {
    inPage({ check: 'ready' })
    console.log('Ready')
  } else if (command === 'settled' && args.length === 0) {
    inPage({ check: 'settled' })
    console.log('Settled')
  } else if (command === 'camera' && args.length === 2 && cameraArgs(args)) {
    const camera = cameraArgs(args)!
    inPage({ check: 'camera', ...camera })
    console.log(`Camera at ${camera.center.join(',')}, zoom ${camera.zoom}`)
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
  } else if ((command === 'score' || command === 'finish') && args.length === 0) {
    const answer = inPage({ check: 'happen', event: command })
    if ('noGame' in answer) throw new Failed(`No Live game on screen can ${command}: turn the camera to one`)
    const { kind, gameId } = (answer as { happened: { kind: string; gameId: string } }).happened
    console.log(`${kind}: ${gameId}, in this tab until the server's next change to it`)
  } else if (panRequest && 'tooLong' in panRequest) {
    console.error(panRequest.tooLong)
    process.exitCode = 2
  } else if (panRequest) {
    const { file, pan } = panRequest
    const { frames } = page.inPage(panGlobe, pan)
    writeFileSync(resolve(file), JSON.stringify(frames))
    console.log(`${frames.length} frames saved to ${resolve(file)}`)
  } else if (touchRequest) {
    await touch(touchRequest)
  } else {
    console.error(usage)
    process.exitCode = 2
  }
}

/** Makes the touch in the session's open tab, through the DevTools Protocol, which agent-browser can't do. */
async function touch(request: Touch): Promise<void> {
  let at: { x: number; y: number }
  if ('selector' in request.at) {
    const answer = inPage({ check: 'point', selector: request.at.selector })
    if ('missing' in answer) throw new Failed(`Nothing matches ${answer.missing}`)
    if ('unreachable' in answer) throw new Failed(`Can't touch ${(answer as { unreachable: string }).unreachable}`)
    at = (answer as { point: { x: number; y: number } }).point
  } else at = request.at
  // The open tab's own target on the browser agent-browser drives.
  const browserUrl = new URL(browser(['get', 'cdp-url']).trim())
  const tabs = JSON.parse(browser(['tab', 'list', '--json'])) as { data: { tabs: { active: boolean; targetId: string }[] } }
  const tab = tabs.data.tabs.find(({ active }) => active)
  if (!tab) throw new Error('agent-browser has no open tab')
  const finger = await touchPage(`ws://${browserUrl.host}/devtools/page/${tab.targetId}`)
  const where = `${Math.round(at.x)},${Math.round(at.y)}`
  try {
    if (request.kind === 'tap') {
      await finger.tap(at.x, at.y)
      console.log(`Tapped at ${where}`)
    } else {
      const took = await finger.swipe([at.x, at.y], request.by, request.ms)
      console.log(`Swiped from ${where} by ${request.by.join(',')} over ${Math.round(took)} ms`)
    }
  } finally {
    finger.close()
  }
}

/** `<lng>,<lat> <zoom>` as a camera, or null if they aren't numbers. */
function cameraArgs([at, zoom]: string[]): { center: [number, number]; zoom: number } | null {
  const [longitude, latitude, ...rest] = at.split(',').map(Number)
  const numbers = [longitude, latitude, Number(zoom)]
  return rest.length === 0 && numbers.every(Number.isFinite) ? { center: [longitude, latitude], zoom: Number(zoom) } : null
}

try {
  await main(process.argv.slice(2))
} catch (error) {
  console.error((error as Error).message)
  process.exitCode = error instanceof Failed || error instanceof TimedOut ? 1 : 2
} finally {
  // The browser daemon, if this started it, may still hold the output files.
  try {
    rmSync(scratch, { recursive: true, force: true })
  } catch {}
}
