/** Score cards a viewer pinned on this visit, in pin order. */
export interface PinnedCards {
  games(): readonly string[]
  subscribe(listener: () => void): () => void
  toggle(gameId: string): void
  retain(gameIds: ReadonlySet<string>): void
}

export function pinnedCards(): PinnedCards {
  let games: readonly string[] = []
  const listeners = new Set<() => void>()
  const update = (next: readonly string[]) => {
    games = next
    for (const listener of listeners) listener()
  }
  return {
    games: () => games,
    subscribe(listener) {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
    toggle(gameId) {
      update(games.includes(gameId) ? games.filter(id => id !== gameId) : [...games, gameId])
    },
    retain(gameIds) {
      const remaining = games.filter(id => gameIds.has(id))
      if (remaining.length !== games.length) update(remaining)
    },
  }
}
