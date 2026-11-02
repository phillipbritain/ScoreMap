import type { GameBout, GameBouts } from './game'

/**
 * The bout a fight card's score card and game panel show as its two sides: the bout on now, else the main
 * event (before the card starts, between bouts and once it's over). As the server's ProviderBouts.OnNow has
 * it, the bouts are listed main event first, so the bout on now is the last Live one.
 */
export function shownBout({ bouts }: GameBouts): GameBout {
  return bouts.findLast((bout) => bout.status === 'Live') ?? bouts[0]
}

/**
 * Where a bout stands, in one line: the round of a bout on now ("R2"); how a finished one was won, with the
 * round and time of a stoppage ("KO/TKO · R2 3:38", "Decision"), "No winner" (a draw or no contest) or
 * "Final" when the feed doesn't say how; "Called off"; nothing before it starts.
 */
export function boutLine({ status, round, clock, method, first, second }: GameBout): string {
  switch (status) {
    case 'Live':
      return round === null ? 'Live' : `R${round}`
    case 'Final':
      if (method === null) return first.winner || second.winner ? 'Final' : 'No winner'
      if (method === 'Decision' || round === null) return method
      return `${method} · ${[`R${round}`, clock].filter(Boolean).join(' ')}`
    case 'Disrupted':
      return 'Called off'
    case 'Upcoming':
      return ''
  }
}
