// PROTOTYPE, throw away: a slider for the most score cards shown at once (see cardCount), on with
// ?cardCountProto in the URL, to find the counts for the card density setting's levels. Nothing is saved.

export const cardCountPrototypeOn = new URLSearchParams(window.location.search).has('cardCountProto')

let chosen: number | null = null
const listeners = new Set<() => void>()

/** The count the slider set, or null for today's (cardCount). */
export function prototypeCardCount(): number | null {
  return cardCountPrototypeOn ? chosen : null
}

/** Calls back each time the slider moves, so the cards lay out afresh. */
export function onPrototypeCardCount(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** The slider's count, or null for today's. Sets it and lays the cards out afresh. */
export function chosenCardCount(): number | null {
  return chosen
}
export function chooseCardCount(next: number | null): void {
  chosen = next
  for (const listener of listeners) listener()
}
