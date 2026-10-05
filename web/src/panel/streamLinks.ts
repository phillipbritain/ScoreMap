// Unofficial stream links (ADR-0002: hobby v1 only). Remove this file, UnofficialStreams.tsx
// and Game.streamLinks together with the server's stream finder before any public launch.
import type { StreamLink } from '../games/game'

/**
 * The unofficial stream links the game panel shows for a game: the server's links, keeping
 * only web addresses since they come from scraped pages. Empty when the finder found nothing.
 */
export function streamLinks(links: StreamLink[]): StreamLink[] {
  return links.filter((link) => isWebAddress(link.url))
}

function isWebAddress(url: string): boolean {
  try {
    const { protocol } = new URL(url)
    return protocol === 'http:' || protocol === 'https:'
  } catch {
    return false
  }
}
