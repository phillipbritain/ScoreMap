import type { CardLayout, ScreenCard } from './cardLayout'

/** The rules every frame of a card layout keeps once gathered, which the tests and the replay check. */
export type GatheringRule = 'every game shows once' | 'no card cluster of one game' | 'trails end where they should'

/**
 * The rules a card layout's last frame breaks, for the cards it was given: a game missing, or shown
 * twice (as its card, or counted in a card cluster or as its small pin); a card cluster of one game;
 * a card's trail not ending at its own venue dot, a venue cluster, or the card cluster that counts it.
 */
export function gatheringRulesBroken(layout: Pick<CardLayout, 'shows' | 'gatherings'>, cards: readonly ScreenCard[]): Set<GatheringRule> {
  const broken = new Set<GatheringRule>()
  const shown = new Map<string, number>()
  const trailEnds = new Map<string, number>()
  const count = (counts: Map<string, number>, gameId: string) => counts.set(gameId, (counts.get(gameId) ?? 0) + 1)
  const given = new Set(cards.map(({ gameId }) => gameId))
  for (const gameId of given) if (layout.shows(gameId).as === 'card') count(shown, gameId)

  for (const { kind, trails, noRoom, at } of layout.gatherings()) {
    for (const gameId of noRoom) count(shown, gameId)
    for (const gameId of trails) count(trailEnds, gameId)
    if (kind === 'cardCluster' && trails.length + noRoom.length < 2) broken.add('no card cluster of one game')
    const counted = [...noRoom, ...trails]
    for (const gameId of trails) {
      const showing = layout.shows(gameId)
      const endsRight =
        showing.as === 'card' &&
        (kind === 'venueDot'
          ? trails.length === 1 && 'venueOf' in at && at.venueOf === gameId
          : kind === 'venueCluster'
            ? showing.cardCluster === undefined
            : kind === 'cardCluster' && showing.cardCluster?.join() === counted.join())
      if (!endsRight) broken.add('trails end where they should')
    }
  }
  for (const gameId of given) {
    if (shown.get(gameId) !== 1) broken.add('every game shows once')
    if (layout.shows(gameId).as === 'card' && trailEnds.get(gameId) !== 1) broken.add('trails end where they should')
  }
  for (const gameId of [...shown.keys(), ...trailEnds.keys()]) if (!given.has(gameId)) broken.add('every game shows once')
  return broken
}
