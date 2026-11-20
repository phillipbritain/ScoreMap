import type { GameBoutSide, GameEntrant, GameField } from '../games/game'

/** How many of a field lead it in the game panel's score block, as on its score card. */
export const leaderCount = 2

/**
 * A field as the game panel lines it up: its leaders in the score block, and the rest of it, from 3rd
 * down, in the band below, so the two read as one leaderboard.
 */
export function fieldLines({ entries }: GameField): { leaders: GameEntrant[]; rest: GameEntrant[] } {
  return { leaders: entries.slice(0, leaderCount), rest: entries.slice(leaderCount) }
}

/**
 * The scores that set the width of a field's score chips, so every line's chip is as wide as the widest:
 * one of each length, rather than every entrant's score under every chip. Scores are in tabular figures,
 * so a score's length is its width.
 */
export function chipSizers({ entries }: GameField): string[] {
  const byLength = new Map<number, string>()
  for (const { score } of entries) if (score !== null && !byLength.has(score.length)) byLength.set(score.length, score)
  return [...byLength.values()]
}

/** A fight card side's score chip: "W" for the winner of its bout; none otherwise, there being no score to show. */
export const boutChip = ({ winner }: GameBoutSide): string | null => (winner ? 'W' : null)
