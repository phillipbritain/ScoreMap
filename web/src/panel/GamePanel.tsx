import { useState } from 'react'
import type { Game, GameTeam, PhotoCredit } from '../games/game'
import { dualTime } from './dualTime'
import { progressLine } from '../games/progressLine'
import { UnofficialStreams } from './UnofficialStreams'
import { viewerCountry, watchLinks, type WatchLink } from './watchLinks'

interface GamePanelProps {
  game: Game
  onClose: () => void
}

/**
 * The game panel: details of the selected game. Beside the globe on wide screens,
 * a bottom sheet on phones (see .game-panel in index.css). Re-renders with each new
 * snapshot, so it stays current while open.
 */
export function GamePanel({ game, onClose }: GamePanelProps) {
  const { venue } = game
  const place = [venue.city, venue.country].filter(Boolean).join(', ')
  const links = watchLinks(game.broadcasters, viewerCountry(navigator.languages))
  // A photo that fails to load is left out, with its credit, rather than shown broken.
  const [brokenPhotoUrl, setBrokenPhotoUrl] = useState<string | null>(null)
  const photo = venue.photo && venue.photo.url !== brokenPhotoUrl ? venue.photo : null

  return (
    <aside className="game-panel" aria-label="Game panel">
      {photo && (
        <img
          className="game-panel__photo"
          src={photo.url}
          alt={venue.name ?? 'The venue'}
          onError={() => setBrokenPhotoUrl(photo.url)}
        />
      )}
      <header className="game-panel__header">
        <span className="game-panel__league">{game.league}</span>
        <button type="button" className="game-panel__close" onClick={onClose} aria-label="Close game panel">
          ×
        </button>
      </header>

      <div className="game-panel__teams">
        <TeamRow team={game.away} />
        <TeamRow team={game.home} />
      </div>
      <p className="game-panel__progress">{progressLine(game, 'full')}</p>

      <dl className="game-panel__details">
        <dt>Venue</dt>
        <dd>
          {venue.name ?? 'Unknown venue'}
          {place && <div className="game-panel__muted">{place}</div>}
        </dd>
        <dt>Start</dt>
        <dd>
          <Time instant={game.startTime} timeZone={venue.timeZone} />
        </dd>
        {game.status === 'Final' && game.endTime && (
          <>
            <dt>End</dt>
            <dd>
              <Time instant={game.endTime} timeZone={venue.timeZone} />
            </dd>
          </>
        )}
        <dt>Watch</dt>
        <dd>
          <WatchLinks links={links} />
        </dd>
        <UnofficialStreams links={game.streamLinks} />
      </dl>
      {photo?.credit && <Credit credit={photo.credit} />}
    </aside>
  )
}

/** The credit a Wikimedia Commons photo's licence asks for: its author and licence, linking to the photo's page. */
function Credit({ credit }: { credit: PhotoCredit }) {
  return (
    <p className="game-panel__credit">
      Photo:{' '}
      <a href={credit.sourceUrl} target="_blank" rel="noopener noreferrer">
        {credit.author}
      </a>
      ,{' '}
      {credit.licenceUrl ? (
        <a href={credit.licenceUrl} target="_blank" rel="noopener noreferrer">
          {credit.licence}
        </a>
      ) : (
        credit.licence
      )}
      , via Wikimedia Commons
    </p>
  )
}

/**
 * Official watch links, as links where the server's watch links file lists the service and
 * plain names otherwise. Unofficial streams (a separate, removable module) follow in their own row.
 */
function WatchLinks({ links }: { links: WatchLink[] }) {
  if (links.length === 0) return <span className="game-panel__muted">No channels listed</span>
  return (
    <ul className="game-panel__watch">
      {links.map((link) => (
        <li key={link.name}>
          {link.url ? (
            <a href={link.url} target="_blank" rel="noopener noreferrer">
              {link.name}
            </a>
          ) : (
            link.name
          )}
        </li>
      ))}
    </ul>
  )
}

function TeamRow({ team }: { team: GameTeam }) {
  return (
    <div className="game-panel__team">
      {team.logoUrl ? <img src={team.logoUrl} alt="" width={40} height={40} /> : <span className="game-panel__logo" />}
      <span className="game-panel__team-name">{team.fullName}</span>
      <span className="game-panel__score">{team.score ?? ''}</span>
    </div>
  )
}

function Time({ instant, timeZone }: { instant: string; timeZone: string | null }) {
  const time = dualTime(instant, timeZone)
  return (
    <>
      {time.viewer}
      {time.venue && <div className="game-panel__muted">{time.venue} at the venue</div>}
    </>
  )
}
