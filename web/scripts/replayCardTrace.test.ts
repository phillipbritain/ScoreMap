// Replays frames a dev run gave its card layout (see `npm run page -- pan`) through a new card layout,
// frame by frame as the app does, and counts how often cards jump and how many frames break each
// gathering rule. Skipped unless CARD_TRACE names a trace; CARD_LAYOUT_COMPARE names another
// cardLayout module to replay the same frames through. See docs/agents/card-layout-replay.md.
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { it } from 'vitest'
import { cardLayout, type Showing } from '../src/globe/cardLayout'
import { gatheringRulesBroken, type GatheringRule } from '../src/globe/gatheringRules'
import type { LaidOutFrame } from '../src/globe/layoutTrace'

const trace = process.env.CARD_TRACE
const compare = process.env.CARD_LAYOUT_COMPARE

// A card moving further than this from where it was, beside a venue on screen, is a jump a viewer sees.
const bigJump = 24

it.skipIf(!trace)('replays a captured pan through the card layout', async () => {
  // A trace saved with agent-browser eval, as before `npm run page -- pan`, may be encoded twice.
  let frames: unknown = JSON.parse(readFileSync(trace!, 'utf8'))
  if (typeof frames === 'string') frames = JSON.parse(frames)
  const layouts: [string, typeof cardLayout][] = [['current', cardLayout]]
  if (compare) layouts.push([compare, (await import(pathToFileURL(resolve(compare)).href)).cardLayout])
  for (const [name, layout] of layouts) console.log(`${name}: ${summary(replay(frames as LaidOutFrame[], layout))}`)
})

/** How a game shows, in a word, for counting jumps by kind. */
const looksOf = (showing: Showing) =>
  showing.as === 'card' ? (showing.moved ? 'moved' : 'above its venue') : showing.as === 'inCardCluster' ? 'in a card cluster' : 'small pin'

function replay(frames: LaidOutFrame[], newLayout: typeof cardLayout) {
  const layout = newLayout()
  const kinds: Record<string, number> = {}
  const broken: Partial<Record<GatheringRule, number>> = {}
  const log: string[] = []
  let cardFrames = 0
  let jumps = 0
  let bigJumps = 0
  frames.forEach(({ cards, scene }, frame) => {
    const before = new Map(cards.map(({ gameId }) => [gameId, layout.shows(gameId)]))
    layout.layOut(cards, scene)
    for (const rule of gatheringRulesBroken(layout, cards)) broken[rule] = (broken[rule] ?? 0) + 1
    for (const { gameId, venueX, venueY } of cards) {
      const was = before.get(gameId)!
      const now = layout.shows(gameId)
      if (was.as === 'notLaidOut' || now.as === 'notLaidOut') continue
      cardFrames++
      const bothCards = was.as === 'card' && now.as === 'card'
      const moved = bothCards ? Math.hypot(now.offset.dx - was.offset.dx, now.offset.dy - was.offset.dy) : 0
      if (was.as === now.as && moved === 0) continue
      jumps++
      const kind = `${looksOf(was)} → ${looksOf(now)}`
      kinds[kind] = (kinds[kind] ?? 0) + 1
      const onScreen = venueX >= 0 && venueX <= scene.width && venueY >= 0 && venueY <= scene.height
      if (!onScreen || !bothCards || moved <= bigJump) continue
      bigJumps++
      log.push(`  frame ${frame} ${gameId}: (${was.offset.dx}, ${was.offset.dy}) → (${now.offset.dx}, ${now.offset.dy}), venue at (${venueX.toFixed(0)}, ${venueY.toFixed(0)})`)
    }
  })
  return { frames: frames.length, cardFrames, jumps, bigJumps, kinds, broken, log }
}

function summary({ frames, cardFrames, jumps, bigJumps, kinds, broken, log }: ReturnType<typeof replay>): string {
  return [
    `${frames} frames, ${cardFrames} card-frames: ${jumps} jumps, ${bigJumps} over ${bigJump} px beside a venue on screen`,
    `  by kind ${JSON.stringify(kinds)}`,
    `  frames breaking a gathering rule ${JSON.stringify(broken)}`,
    ...log,
  ].join('\n')
}
