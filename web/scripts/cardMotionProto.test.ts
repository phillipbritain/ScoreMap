// PROTOTYPE, throwaway: replays every trace in CARD_TRACE_DIR through each cardMotionProto variant
// and prints how much the cards moved. Skipped unless CARD_TRACE_DIR is set.
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { it } from 'vitest'
import { cardLayout } from '../src/globe/cardLayout'
import { cardMotionVariants, setCardMotionVariant, type CardMotionVariant } from '../src/globe/cardMotionProto'
import { gatheringRulesBroken } from '../src/globe/gatheringRules'
import type { LaidOutFrame } from '../src/globe/layoutTrace'

const dir = process.env.CARD_TRACE_DIR

it.skipIf(!dir)('replays traces through each card motion variant', () => {
  const files = readdirSync(dir!).filter((f) => f.startsWith('fixed-') && f.endsWith('.json'))
  const rows: string[] = ['trace'.padEnd(18) + 'variant'.padEnd(12) + 'big-moving big-still glides  px/frame  swaps overlaps/frame cards-at-end broken reach-at-end']
  for (const file of files) {
    const frames = JSON.parse(readFileSync(join(dir!, file), 'utf8')) as LaidOutFrame[]
    for (const variant of cardMotionVariants) rows.push(file.replace('fixed-', '').replace('.json', '').padEnd(18) + variant.padEnd(12) + measure(frames, variant))
    rows.push('')
  }
  console.log(rows.join('\n'))
}, 600_000)

function measure(frames: LaidOutFrame[], variant: CardMotionVariant): string {
  setCardMotionVariant(variant)
  const layout = cardLayout()
  let bigMoving = 0
  let bigStill = 0
  let glides = 0
  let px = 0
  let swaps = 0
  let overlaps = 0
  let broken = 0
  let cardsAtEnd = 0
  let reach = 0
  for (const { cards, scene } of frames) {
    const before = new Map(cards.map(({ gameId }) => [gameId, layout.shows(gameId)]))
    layout.layOut(cards, scene)
    broken += gatheringRulesBroken(layout, cards).size
    const moving = scene.moving === true || scene.cameraMoving === true
    const boxes: { x: number; y: number; w: number; h: number }[] = []
    cardsAtEnd = 0
    reach = 0
    for (const { gameId, venueX, venueY, width, height } of cards) {
      const was = before.get(gameId)!
      const now = layout.shows(gameId)
      const onScreen = venueX >= 0 && venueX <= scene.width && venueY >= 0 && venueY <= scene.height
      if (now.as === 'card' && onScreen) {
        cardsAtEnd++
        reach += Math.hypot(now.offset.dx, now.offset.dy + scene.venueGap)
        boxes.push({ x: venueX + now.offset.dx - width / 2, y: venueY + now.offset.dy - height, w: width, h: height })
      }
      if (!onScreen || was.as === 'notLaidOut' || now.as === 'notLaidOut') continue
      if ((was.as === 'card') !== (now.as === 'card')) swaps++
      if (was.as !== 'card' || now.as !== 'card') continue
      const d = Math.hypot(now.offset.dx - was.offset.dx, now.offset.dy - was.offset.dy)
      px += d
      if (d > 6) glides++
      if (d > 24) {
        if (moving) bigMoving++
        else bigStill++
      }
    }
    for (let i = 0; i < boxes.length; i++)
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i]
        const b = boxes[j]
        const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)
        const oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y)
        if (ox > 4 && oy > 4) overlaps++
      }
  }
  const n = frames.length
  return [bigMoving, bigStill, glides, (px / n).toFixed(1), swaps, (overlaps / n).toFixed(2), cardsAtEnd, broken, (reach / Math.max(1, cardsAtEnd)).toFixed(0)]
    .map((v, i) => String(v).padStart([10, 10, 7, 10, 7, 15, 13, 7, 13][i]))
    .join('')
}
