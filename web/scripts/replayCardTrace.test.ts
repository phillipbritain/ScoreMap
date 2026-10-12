// Replays frames a dev run laid its score cards out from (see `npm run page -- pan`) through the layout,
// frame by frame as the app does, and counts how often cards jump. Skipped unless CARD_TRACE names a
// trace; CARD_LAYOUT_COMPARE names another cardLayout module to replay the same frames through. See
// docs/agents/card-layout-replay.md.
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { it } from 'vitest'
import { layOutCards, type CardPlacement } from '../src/globe/cardLayout'
import type { LaidOutFrame } from '../src/globe/layoutTrace'

const trace = process.env.CARD_TRACE
const compare = process.env.CARD_LAYOUT_COMPARE

// A card moving further than this from where it was, beside a venue on screen, is a jump a viewer sees.
const bigJump = 24

it.skipIf(!trace)('replays a captured pan through the card layout', async () => {
  // A trace saved with agent-browser eval, as before `npm run page -- pan`, may be encoded twice.
  let frames: unknown = JSON.parse(readFileSync(trace!, 'utf8'))
  if (typeof frames === 'string') frames = JSON.parse(frames)
  const layouts: [string, typeof layOutCards][] = [['current', layOutCards]]
  if (compare) layouts.push([compare, (await import(pathToFileURL(resolve(compare)).href)).layOutCards])
  for (const [name, layOut] of layouts) console.log(`${name}: ${summary(replay(frames as LaidOutFrame[], layOut))}`)
})

function replay(frames: LaidOutFrame[], layOut: typeof layOutCards) {
  let previous = new Map<string, CardPlacement>()
  const kinds: Record<string, number> = {}
  const log: string[] = []
  let cardFrames = 0
  let jumps = 0
  let bigJumps = 0
  frames.forEach(({ cards, scene }, frame) => {
    const layout = layOut(cards, scene, previous)
    for (const { gameId, venueX, venueY } of cards) {
      const was = previous.get(gameId)
      const now = layout.cards.get(gameId)
      if (!was || !now) continue
      cardFrames++
      const moved = Math.hypot(now.offset.dx - was.offset.dx, now.offset.dy - was.offset.dy)
      if (moved === 0 && was.inCardCluster === now.inCardCluster) continue
      jumps++
      const kind = was.inCardCluster
        ? 'out of a card cluster'
        : now.inCardCluster
          ? 'into a card cluster'
          : `${was.trail ? 'moved' : 'over its venue'} → ${now.trail ? 'moved' : 'over its venue'}`
      kinds[kind] = (kinds[kind] ?? 0) + 1
      const onScreen = venueX >= 0 && venueX <= scene.width && venueY >= 0 && venueY <= scene.height
      if (!onScreen || was.inCardCluster || now.inCardCluster || moved <= bigJump) continue
      bigJumps++
      log.push(`  frame ${frame} ${gameId}: (${was.offset.dx}, ${was.offset.dy}) → (${now.offset.dx}, ${now.offset.dy}), venue at (${venueX.toFixed(0)}, ${venueY.toFixed(0)})`)
    }
    previous = layout.cards
  })
  return { frames: frames.length, cardFrames, jumps, bigJumps, kinds, log }
}

function summary({ frames, cardFrames, jumps, bigJumps, kinds, log }: ReturnType<typeof replay>): string {
  return [
    `${frames} frames, ${cardFrames} card-frames: ${jumps} jumps, ${bigJumps} over ${bigJump} px beside a venue on screen`,
    `  by kind ${JSON.stringify(kinds)}`,
    ...log,
  ].join('\n')
}
