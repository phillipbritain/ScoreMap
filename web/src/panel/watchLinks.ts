import type { GameBroadcaster } from '../games/game'

/** A channel or streaming service with an official watch link, as the game panel lists it. */
export interface WatchLink {
  name: string
  url: string
}

/**
 * The official watch links the game panel shows a viewer in `viewerCountry` (ISO 3166 alpha-2,
 * or null when unknown). When the data has broadcasts for the viewer's country, broadcasts it places
 * in another country are left out; otherwise every linked broadcast is listed. Broadcasters with
 * no watch URL are omitted.
 */
export function watchLinks(broadcasters: GameBroadcaster[], viewerCountry: string | null): WatchLink[] {
  const local = broadcasters.some((b) => b.country !== null && sameCountry(b.country, viewerCountry))
  const links = new Map<string, WatchLink>()
  for (const b of broadcasters) {
    if (!b.watchUrl?.trim() || (local && !isFor(b.country, viewerCountry)) || links.has(b.name)) continue
    links.set(b.name, { name: b.name, url: b.watchUrl })
  }
  return [...links.values()]
}

/**
 * The viewer's country (ISO 3166 alpha-2), from the first of their browser locales that names
 * one (e.g. "en-GB"), or null when none does. No location permission is asked for.
 */
export function viewerCountry(locales: readonly string[]): string | null {
  for (const tag of locales) {
    try {
      const region = new Intl.Locale(tag).region
      if (region && /^[A-Z]{2}$/.test(region)) return region
    } catch {
      // Not a valid locale tag; try the next one.
    }
  }
  return null
}

function isFor(broadcastCountry: string | null, viewerCountry: string | null): boolean {
  return broadcastCountry === null || sameCountry(broadcastCountry, viewerCountry)
}

function sameCountry(a: string, b: string | null): boolean {
  return b !== null && a.toUpperCase() === b.toUpperCase()
}
/** How many watch links the game panel lists, on one line; more would run past it, so the rest fold into "+N more". */
export const listedWatchLinkCount = 2

/** The watch links the game panel lists, in order, and the ones folded into "+N more". */
export function listedWatchLinks<T>(links: readonly T[]): { listed: T[]; folded: T[] } {
  return { listed: links.slice(0, listedWatchLinkCount), folded: links.slice(listedWatchLinkCount) }
}
