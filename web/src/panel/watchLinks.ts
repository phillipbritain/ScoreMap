import type { GameBroadcaster } from '../games/game'

/** A channel or streaming service as the game panel lists it: linked when it has an official watch link. */
export interface WatchLink {
  name: string
  url: string | null
}

/**
 * The official watch links the game panel shows a viewer in `viewerCountry` (ISO 3166 alpha-2,
 * or null when unknown). When the data has broadcasts for the viewer's country, broadcasts it places
 * in another country are left out; otherwise every broadcast is listed, so a viewer abroad still sees
 * which channels show the game.
 */
export function watchLinks(broadcasters: GameBroadcaster[], viewerCountry: string | null): WatchLink[] {
  const local = broadcasters.some((b) => b.country !== null && sameCountry(b.country, viewerCountry))
  const links = new Map<string, WatchLink>()
  for (const b of broadcasters) {
    if ((local && !isFor(b.country, viewerCountry)) || links.has(b.name)) continue
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