// Unofficial stream links (ADR-0002: hobby v1 only); see streamLinks.ts for removal.
import type { StreamLink } from '../games/game'
import { streamLinks } from './streamLinks'

/** The game panel's unofficial streams, after the official services. Renders nothing when there are none. */
export function UnofficialStreams({ links }: { links: StreamLink[] }) {
  const shown = streamLinks(links)
  if (shown.length === 0) return null
  return (
    <>
      <dt>Streams</dt>
      <dd>
        <ul className="game-panel__watch">
          {shown.map((link) => (
            <li key={link.url}>
              <a href={link.url} target="_blank" rel="noopener noreferrer nofollow">
                {link.site}
              </a>
            </li>
          ))}
        </ul>
        <div className="game-panel__muted">Unofficial</div>
      </dd>
    </>
  )
}
