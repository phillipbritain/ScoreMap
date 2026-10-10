import { useState, type CSSProperties, type Ref } from 'react'
import type { Game, GameTeam, PhotoCredit } from '../games/game'
import { dualTime } from './dualTime'
import { progressLine } from '../games/progressLine'
import { streamLinks } from './streamLinks'
import { listedWatchLinks, viewerCountry, watchLinks } from './watchLinks'

interface GamePanelProps {
  game: Game
  onClose: () => void
  /** The panel's element, so the globe can keep the selected pin clear of it. */
  ref?: Ref<HTMLElement>
}

/** A link in the panel's Watch column: an official channel or service, or an unofficial stream. */
interface PanelLink {
  name: string
  url: string | null
  unofficial: boolean
}

/**
 * The game panel: details of the selected game, as a TV-style strip across the bottom of the globe
 * (see .game-panel in index.css). It keeps one size whatever the game, so selecting one game after
 * another doesn't make it jump: long text is clipped, with the full text on hover. Re-renders with
 * each new snapshot, so it stays current while open.
 */
export function GamePanel({ game, onClose, ref }: GamePanelProps) {
  const { venue } = game
  const place = [venue.city, venue.country].filter(Boolean).join(', ')
  const venueName = venue.name ?? 'Unknown venue'
  const progress = progressLine(game, 'full')
  // A Final game shows when it ended; any other, when it starts.
  const endTime = game.status === 'Final' ? game.endTime : null
  const time = dualTime(endTime ?? game.startTime, venue.timeZone)
  const links: PanelLink[] = [
    ...watchLinks(game.broadcasters, viewerCountry(navigator.languages)).map((link) => ({ ...link, unofficial: false })),
    // Unofficial stream links (ADR-0002: hobby v1 only); see streamLinks.ts for removal.
    ...streamLinks(game.streamLinks).map((link) => ({ name: link.site, url: link.url, unofficial: true })),
  ]
  // A photo that fails to load is left out, with its credit, rather than shown broken.
  const [brokenPhotoUrl, setBrokenPhotoUrl] = useState<string | null>(null)
  const photo = venue.photo && venue.photo.url !== brokenPhotoUrl ? venue.photo : null
  // Lit in the game's status colour, as its score card is.
  const statusStyle = { '--status-color': `var(--${game.status.toLowerCase()}-color)` } as CSSProperties

  return (
    <aside ref={ref} className="game-panel" style={statusStyle} aria-label="Game panel">
      <div className="game-panel__score">
        <div className="game-panel__league">{game.league}</div>
        <TeamRow team={game.away} />
        <TeamRow team={game.home} />
        {progress && <div className="game-panel__progress">{progress}</div>}
      </div>

      <div className="game-panel__details">
        <div>
          <div className="game-panel__label">Venue</div>
          <div className="game-panel__value" title={venueName}>
            {venueName}
          </div>
          <div className="game-panel__muted" title={place}>
            {place}
          </div>
        </div>
        <div>
          <div className="game-panel__label">{endTime ? 'Ended' : 'Start'}</div>
          <div className="game-panel__value" title={time.viewer}>
            {time.viewer}
          </div>
          <div className="game-panel__muted">{time.venue && `${time.venue} local`}</div>
        </div>
        <div>
          <div className="game-panel__label">Watch</div>
          <WatchLinks links={links} />
        </div>
      </div>

      {/* Kept when there's no photo, so the details keep their width. */}
      <figure className="game-panel__photo">
        {photo && (
          <>
            <img src={photo.url} alt={venue.name ?? 'The venue'} onError={() => setBrokenPhotoUrl(photo.url)} />
            {photo.credit && <Credit credit={photo.credit} />}
          </>
        )}
      </figure>

      <button type="button" className="game-panel__close" onClick={onClose} aria-label="Close game panel">
        ×
      </button>
    </aside>
  )
}

/**
 * The credit a Wikimedia Commons photo's licence asks for: its author, linking to the photo's page,
 * and its licence. Shown over the photo on hover.
 */
function Credit({ credit }: { credit: PhotoCredit }) {
  return (
    <figcaption className="game-panel__credit" title={`Photo: ${credit.author}, ${credit.licence}, via Wikimedia Commons`}>
      <a href={credit.sourceUrl} target="_blank" rel="noopener noreferrer">
        {credit.author}
      </a>
      {' · '}
      {credit.licenceUrl ? (
        <a href={credit.licenceUrl} target="_blank" rel="noopener noreferrer">
          {credit.licence}
        </a>
      ) : (
        credit.licence
      )}
    </figcaption>
  )
}

/**
 * Official watch links, then unofficial streams, as links where there's a web address and plain
 * names otherwise. The first few are listed; the rest are named on hover over "+N more".
 */
function WatchLinks({ links }: { links: PanelLink[] }) {
  if (links.length === 0) return <div className="game-panel__muted">No channels listed</div>
  const { listed, folded } = listedWatchLinks(links)
  return (
    <ul className="game-panel__watch">
      {listed.map((link) => (
        <li key={`${link.name} ${link.url}`} title={link.unofficial ? `${link.name} (unofficial stream)` : link.name}>
          {link.url ? (
            <a
              href={link.url}
              target="_blank"
              rel={link.unofficial ? 'noopener noreferrer nofollow' : 'noopener noreferrer'}
            >
              {link.name}
            </a>
          ) : (
            link.name
          )}
          {link.unofficial && <span className="game-panel__unofficial"> · unofficial</span>}
        </li>
      ))}
      {folded.length > 0 && (
        <li className="game-panel__muted" title={folded.map((link) => link.name).join(', ')}>
          +{folded.length} more
        </li>
      )}
    </ul>
  )
}

function TeamRow({ team }: { team: GameTeam }) {
  return (
    <div className="game-panel__team">
      {team.logoUrl ? <img src={team.logoUrl} alt="" width={28} height={28} /> : <span className="game-panel__logo" />}
      <span className="game-panel__team-name" title={team.fullName}>
        {team.fullName}
      </span>
      <span className="game-panel__team-score">{team.score ?? '–'}</span>
    </div>
  )
}
