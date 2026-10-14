import type { GameOdds, GameSituation, KeyEvent } from '../games/game'

/**
 * Where play stands, in one line: in football the down and distance and who has the ball ("2nd & 7 at
 * OSU 34 · OSU ball"), in baseball the count and outs ("2-1 · 1 out"). Null in a sport with neither,
 * where the last play says it all.
 */
export function situationLine(situation: GameSituation): string | null {
  const { downAndDistance, possession, balls, strikes, outs } = situation
  if (downAndDistance) return possession ? `${downAndDistance} · ${possession} ball` : downAndDistance
  const parts = [
    balls !== null && strikes !== null ? `${balls}-${strikes}` : null,
    outs !== null ? `${outs} ${outs === 1 ? 'out' : 'outs'}` : null,
  ].filter((part) => part !== null)
  return parts.length > 0 ? parts.join(' · ') : null
}

/** Whether the situation is baseball's, so its bases are worth drawing. */
export function hasBases(situation: GameSituation): boolean {
  return situation.outs !== null
}

/** The betting line in one line: "SEA -2.5 · O/U 40.5", or whichever half the bookmaker gives. */
export function oddsLine({ line, overUnder }: GameOdds): string | null {
  const parts = [line, overUnder !== null ? `O/U ${overUnder}` : null].filter((part) => part !== null)
  return parts.length > 0 ? parts.join(' · ') : null
}

/** A goal's or card's player, marked when the goal was a penalty or an own goal: "Bukayo Saka (pen)", "Ben White (og)". */
export function keyEventName({ kind, player }: KeyEvent): string {
  const name = player ?? 'Unknown player'
  if (kind === 'PenaltyGoal') return `${name} (pen)`
  if (kind === 'OwnGoal') return `${name} (og)`
  return name
}

/** Whether a key event is a goal (of any kind) rather than a card. */
export function isGoal({ kind }: KeyEvent): boolean {
  return kind === 'Goal' || kind === 'PenaltyGoal' || kind === 'OwnGoal'
}

/** Every key event in one line, for a tooltip: "38' Goal Declan Rice (ARS), 58' Yellow card Lucas Paquetá (WHU)". */
export function keyEventsSummary(events: KeyEvent[]): string {
  const what = { Goal: 'Goal', PenaltyGoal: 'Goal', OwnGoal: 'Goal', YellowCard: 'Yellow card', RedCard: 'Red card' }
  return events.map((e) => `${e.clock ?? ''} ${what[e.kind]} ${keyEventName(e)} (${e.team})`.trim()).join(', ')
}
