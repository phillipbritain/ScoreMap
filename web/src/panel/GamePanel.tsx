import { useState, type CSSProperties, type ReactNode, type Ref } from 'react'
import type { Game, GameTeam, PhotoCredit } from '../games/game'
import { dualTime } from './dualTime'
import { oddsLine } from './gameDetails'
import { mapsSearchUrl, venuePlace } from './venuePlace'
import { progressLine } from '../games/progressLine'
import { sidesTopFirst } from '../games/sides'
import { streamLinks } from './streamLinks'
import { listedWatchLinks, viewerCountry, watchLinks } from './watchLinks'

interface GamePanelProps {
  game: Game
  /** The game's colour (see gameColour), for the panel's top edge, glow and progress line. */
  colour: string
  /** The colour of text on the game's colour, readable on it (see textOn). */
  textOnColour: string
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
 * (see .game-panel in index.css), with a band under it: the last score, the betting line and the crowd. It keeps one size
 * whatever the game, so selecting one game after another doesn't make it jump: long text is clipped,
 * with the full text on hover where it's cut off. Re-renders with each new snapshot, so it stays current while open.
 */
export function GamePanel({ game, colour, textOnColour, onClose, ref }: GamePanelProps) {
  const { venue } = game
  const place = venuePlace(venue)
  // A tennis match's venue is its tournament, which its note already names, so it shows the court and city on one line.
  const tennis = game.sport === 'Tennis'
  const venueName = (tennis ? [venue.court, place].filter(Boolean).join(' · ') : venue.name) || 'Unknown venue'
  // The place under the venue's name; in tennis, already on the venue's line.
  const placeLine = tennis ? '' : place
  const progress = progressLine(game, 'full')
  const [top, bottom] = sidesTopFirst(game)
  // A note on the game (a playoff round, say) goes beside its league.
  const league = game.note ? `${game.league} · ${game.note}` : game.league
  // A Final game shows when it ended; any other, when it starts.
  const endTime = game.status === 'Final' ? game.endTime : null
  const time = dualTime(endTime ?? game.startTime, venue.timeZone)
  const localTime = time.venue ? `${time.venue} local` : ''
  const links: PanelLink[] = [
    ...watchLinks(game.broadcasters, viewerCountry(navigator.languages)).map((link) => ({ ...link, unofficial: false })),
    // Unofficial stream links (ADR-0002: hobby v1 only); see streamLinks.ts for removal.
    ...streamLinks(game.streamLinks).map((link) => ({ name: link.site, url: link.url, unofficial: true })),
  ]
  // A photo that fails to load is left out, with its credit, rather than shown broken.
  const [brokenPhotoUrl, setBrokenPhotoUrl] = useState<string | null>(null)
  const photo = venue.photo && venue.photo.url !== brokenPhotoUrl ? venue.photo : null
  // Lit in the game's colour, as its score card is.
  const colourStyle = { '--game-color': colour, '--text-on-game-color': textOnColour } as CSSProperties

  return (
    <aside ref={ref} className="game-panel" style={colourStyle} aria-label="Game panel">
      <div className="game-panel__main">
        <div className="game-panel__score">
          <div className="game-panel__league" data-tooltip={`${game.sport} · ${league}`} data-tooltip-when-clipped>
            {/* The sport goes here on a phone, where the details have no room for its column. */}
            <span className="game-panel__league-sport">{game.sport} · </span>
            {league}
          </div>
          <TeamRow team={top} />
          <TeamRow team={bottom} />
          {progress && (
            <div className="game-panel__progress" data-tooltip={progress} data-tooltip-when-clipped>
              {progress}
            </div>
          )}
        </div>

        <div className="game-panel__details">
          <div className="game-panel__sport">
            <div className="game-panel__label">Sport</div>
            <div className="game-panel__value" data-tooltip={game.sport} data-tooltip-when-clipped>
              {game.sport}
            </div>
          </div>
          <div>
            <div className="game-panel__label">Venue</div>
            <div className="game-panel__value" data-tooltip={venueName} data-tooltip-when-clipped>
              {venue.name ? <MapsLink query={[venue.name, place].filter(Boolean).join(', ')}>{venueName}</MapsLink> : venueName}
            </div>
            <div className="game-panel__muted" data-tooltip={placeLine} data-tooltip-when-clipped>
              {placeLine && <MapsLink query={placeLine}>{placeLine}</MapsLink>}
            </div>
          </div>
          <div>
            <div className="game-panel__label">{endTime ? 'Ended' : 'Start'}</div>
            <div className="game-panel__value" data-tooltip={time.viewer} data-tooltip-when-clipped>
              {time.viewer}
            </div>
            <div className="game-panel__muted" data-tooltip={localTime} data-tooltip-when-clipped>
              {localTime}
            </div>
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
      </div>

      <GameBand game={game} />

      <button type="button" className="game-panel__close" onClick={onClose} aria-label="Close game panel">
        ×
      </button>
    </aside>
  )
}

/** A link to a place (the venue, or its city) in Google Maps, in a new tab. */
function MapsLink({ query, children }: { query: string; children: ReactNode }) {
  return (
    <a className="game-panel__maps-link" href={mapsSearchUrl(query)} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  )
}

/**
 * The credit a Wikimedia Commons photo's licence asks for: its author, linking to the photo's page,
 * and its licence. Shown over the photo on hover.
 */
function Credit({ credit }: { credit: PhotoCredit }) {
  return (
    <figcaption className="game-panel__credit" data-tooltip={`Photo: ${credit.author}, ${credit.licence}, via Wikimedia Commons`} data-tooltip-when-clipped>
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
  if (links.length === 0) return (
      <div className="game-panel__muted" data-tooltip="No channels listed" data-tooltip-when-clipped>
        No channels listed
      </div>
    )
  const { listed, folded } = listedWatchLinks(links)
  return (
    <ul className="game-panel__watch">
      {listed.map((link) => (
        <li key={`${link.name} ${link.url}`} data-tooltip={link.unofficial ? `${link.name} (unofficial stream)` : link.name} data-tooltip-when-clipped>
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
        <li className="game-panel__muted" data-tooltip={folded.map((link) => link.name).join(', ')}>
          +{folded.length} more
        </li>
      )}
    </ul>
  )
}

/** A team: its logo, its poll ranking if it has one, its name, its record and its score. */
function TeamRow({ team }: { team: GameTeam }) {
  const name = team.rank !== null ? `#${team.rank} ${team.fullName}` : team.fullName
  return (
    <div className="game-panel__team">
      {team.logoUrl ? <img src={team.logoUrl} alt="" /> : <span className="game-panel__logo" />}
      <span className="game-panel__team-name" data-tooltip={team.record ? `${name} (${team.record})` : name} data-tooltip-when-clipped>
        {team.rank !== null && <span className="game-panel__rank">#{team.rank} </span>}
        {team.fullName}
      </span>
      {team.record && <span className="game-panel__record">{team.record}</span>}
      <span className="game-panel__team-score">{team.score ?? '–'}</span>
    </div>
  )
}

/**
 * The band under the strip: the last score (who scored and when; in soccer the goal's scorer and
 * minute), or in tennis the scoreline set by set, the betting line and the crowd, each with its label.
 */
function GameBand({ game }: { game: Game }) {
  const { lastScore, scoreline } = game
  const odds = game.odds && oddsLine(game.odds)
  const empty = !lastScore && !scoreline && !odds && game.attendance === null
  return (
    <div className="game-panel__band">
      {scoreline && (
        // Each set in the progress line's look: its name, its score and who won it.
        <BandCell wide>
          <div className="game-panel__sets">
            {scoreline.sets.map((set) => (
              <span key={set.name} className="game-panel__set">
                {[set.name, set.score, set.winner].filter(Boolean).join(' · ')}
              </span>
            ))}
            {scoreline.ending && <span className="game-panel__strong">{scoreline.ending}</span>}
            {scoreline.advanced && <span className="game-panel__one-line">{scoreline.advanced} advances</span>}
          </div>
        </BandCell>
      )}
      {lastScore && (
        <BandCell label="Last score" wide>
          <div className="game-panel__clamp" data-tooltip={`${lastScore.when ?? ''} ${lastScore.team}: ${lastScore.text}`.trim()} data-tooltip-when-clipped>
            <span className="game-panel__strong">
              {lastScore.when && `${lastScore.when} · `}
              {lastScore.team}
            </span>{' '}
            {lastScore.text}
          </div>
        </BandCell>
      )}
      {odds && (
        <BandCell label="Odds">
          <div className="game-panel__one-line" data-tooltip={odds} data-tooltip-when-clipped>
            {odds}
          </div>
          {game.odds?.bookmaker && (
            <div className="game-panel__muted game-panel__one-line" data-tooltip={game.odds.bookmaker} data-tooltip-when-clipped>
              {game.odds.bookmaker}
            </div>
          )}
        </BandCell>
      )}
      {game.attendance !== null && (
        <BandCell label="Attendance">
          <div className="game-panel__one-line" data-tooltip={game.attendance.toLocaleString()} data-tooltip-when-clipped>
            {game.attendance.toLocaleString()}
          </div>
        </BandCell>
      )}
      {empty && <div className="game-panel__muted game-panel__band-empty">No game details yet</div>}
    </div>
  )
}

/** A cell of the band, with its label above it when it has one. */
function BandCell({ label, wide = false, children }: { label?: string; wide?: boolean; children: ReactNode }) {
  return (
    <div className={wide ? 'game-panel__cell game-panel__cell--wide' : 'game-panel__cell'}>
      {label && <div className="game-panel__label">{label}</div>}
      {children}
    </div>
  )
}
