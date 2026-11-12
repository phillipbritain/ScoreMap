/** How many watch links the game panel lists, on one line; more would run past it, so the rest fold into "+N more". */
export const listedWatchLinkCount = 2

/** The watch links the game panel lists, in order, and the ones folded into "+N more". */
export function listedWatchLinks<T>(links: readonly T[]): { listed: T[]; folded: T[] } {
  return { listed: links.slice(0, listedWatchLinkCount), folded: links.slice(listedWatchLinkCount) }
}
