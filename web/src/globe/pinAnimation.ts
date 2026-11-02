import type { Game, GameBouts, GameContest, GameEntrant, GameField } from '../games/game'

/**
 * How a pin (or the cluster it's in) draws attention to a change: a lively burst when the score
 * changes, a pulse when a game starts, and a calmer fade when it finishes. The styles live in CSS.
 */
export type PinAnimation = 'score' | 'start' | 'finish'

/**
 * Which animation a game plays, going from how the globe last showed it to how it is now; null for
 * changes that only redraw it (the clock, the period, a delay). A game that starts or finishes
 * plays that, even if its score changed in the same update. Basketball scores so often that its
 * score changes pulse only in clutch time, as the server judges it on the score after the basket.
 * A field's score changes when the lead changes hands, and a fight card's when a bout finishes, as the
 * server's GameChanges has it.
 */
export function pinAnimation(before: Game, after: Game): PinAnimation | null {
  if (before.status === 'Upcoming' && after.status === 'Live') return 'start'
  if (before.status === 'Live' && after.status === 'Final') return 'finish'
  if (scoreChanged(before.contest, after.contest) && (after.sport !== 'Basketball' || after.clutchTime)) return 'score'
  return null
}

function scoreChanged(was: GameContest, now: GameContest): boolean {
  if (was.kind === 'sides' && now.kind === 'sides') {
    return was.home.score !== now.home.score || was.away.score !== now.away.score
  }
  if (was.kind === 'field' && now.kind === 'field') {
    const [leader, newLeader] = [soleLeader(was), soleLeader(now)]
    return leader !== null && newLeader !== null && leader.name !== newLeader.name
  }
  if (was.kind === 'bouts' && now.kind === 'bouts') {
    const finished = finishedBouts(was)
    return now.bouts.some((bout) => bout.status === 'Final' && !finished.has(bout.id))
  }
  return false
}

/** The ids of a fight card's bouts that are over. */
function finishedBouts({ bouts }: GameBouts): Set<string> {
  return new Set(bouts.filter((bout) => bout.status === 'Final').map((bout) => bout.id))
}

/** The entrant leading alone; null with no field yet, or with more than one at the front. */
function soleLeader({ entries }: GameField): GameEntrant | null {
  return entries.filter((entrant) => entrant.position === 1).length === 1 ? entries[0] : null
}
