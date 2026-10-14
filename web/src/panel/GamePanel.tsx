import { useState, type CSSProperties, type ReactNode, type Ref } from 'react'
import type { Game, GameSituation, GameTeam, KeyEvent, PhotoCredit } from '../games/game'
import { dualTime } from './dualTime'
import { hasBases, isGoal, keyEventName, keyEventsSummary, oddsLine, situationLine } from './gameDetails'
import { venuePlace } from './venuePlace'
import { progressLine } from '../games/progressLine'
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
 * (see .game-panel in index.css), with a band under it for how the game is going: the last score (in
 * soccer the goals and cards), where play stands, the betting line and the crowd. It keeps one size
 * whatever the game, so selecting one game after another doesn't make it jump: long text is clipped,
 * with the full text on hover. Re-renders with each new snapshot, so it stays current while open.
 */
export function GamePanel({ game, colour, textOnColour, onClose, ref }: GamePanelProps) {
  const { venue } = game
  const place = venuePlace(venue)
  const venueName = venue.name ?? 'Unknown venue'
  const progress = progressLine(game, 'full')
  // A note on the game (a playoff round, say) goes beside its league.
  const league = game.note ? `${game.league} · ${game.note}` : game.league
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
  // Lit in the game's colour, as its score card is.
  const colourStyle = { '--game-color': colour, '--text-on-game-color': textOnColour } as CSSProperties

  return (
    <aside ref={ref} className="game-panel" style={colourStyle} aria-label="Game panel">
      <div className="game-panel__main">
        <div className="game-panel__score">
          <div className="game-panel__league" title={league}>
            {league}
          </div>
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
      </div>

      <GameBand game={game} />

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

/** A team: its logo, its poll ranking if it has one, its name, its record and its score. */
function TeamRow({ team }: { team: GameTeam }) {
  const name = team.rank !== null ? `#${team.rank} ${team.fullName}` : team.fullName
  return (
    <div className="game-panel__team">
      {team.logoUrl ? <img src={team.logoUrl} alt="" /> : <span className="game-panel__logo" />}
      <span className="game-panel__team-name" title={team.record ? `${name} (${team.record})` : name}>
        {team.rank !== null && <span className="game-panel__rank">#{team.rank} </span>}
        {team.fullName}
      </span>
      {team.record && <span className="game-panel__record">{team.record}</span>}
      <span className="game-panel__team-score">{team.score ?? '–'}</span>
    </div>
  )
}

/**
 * The band under the strip: what there is of the last score (in soccer, the goals and cards), where play
 * stands while the game is Live, the betting line and the crowd, each with its label.
 */
function GameBand({ game }: { game: Game }) {
  const { lastScore, situation } = game
  const odds = game.odds && oddsLine(game.odds)
  const empty = game.keyEvents.length === 0 && !lastScore && !situation && !odds && game.attendance === null
  return (
    <div className="game-panel__band">
      {game.keyEvents.length > 0 ? (
        <BandCell label="Goals & cards" wide>
          <KeyEvents events={game.keyEvents} />
        </BandCell>
      ) : (
        lastScore && (
          <BandCell label="Last score" wide>
            <div className="game-panel__clamp" title={`${lastScore.when ?? ''} ${lastScore.team}: ${lastScore.text}`.trim()}>
              <span className="game-panel__strong">
                {lastScore.when && `${lastScore.when} · `}
                {lastScore.team}
              </span>{' '}
              {lastScore.text}
            </div>
          </BandCell>
        )
      )}
      {situation && (
        <BandCell label="Now" wide>
          <Situation situation={situation} />
        </BandCell>
      )}
      {odds && (
        <BandCell label="Odds">
          <div className="game-panel__one-line" title={odds}>
            {odds}
          </div>
          {game.odds?.bookmaker && <div className="game-panel__muted game-panel__one-line">{game.odds.bookmaker}</div>}
        </BandCell>
      )}
      {game.attendance !== null && (
        <BandCell label="Attendance">
          <div className="game-panel__one-line">{game.attendance.toLocaleString()}</div>
        </BandCell>
      )}
      {empty && <div className="game-panel__muted game-panel__band-empty">No game details yet</div>}
    </div>
  )
}

function BandCell({ label, wide = false, children }: { label: string; wide?: boolean; children: ReactNode }) {
  return (
    <div className={wide ? 'game-panel__cell game-panel__cell--wide' : 'game-panel__cell'}>
      <div className="game-panel__label">{label}</div>
      {children}
    </div>
  )
}

/** Where play stands: the line for it (with the bases, in baseball), then the last play. */
function Situation({ situation }: { situation: GameSituation }) {
  const line = situationLine(situation)
  return (
    <>
      {line && (
        <div className="game-panel__one-line game-panel__situation" title={line}>
          {hasBases(situation) && <Bases situation={situation} />}
          {line}
        </div>
      )}
      {situation.lastPlay && (
        <div className={line ? 'game-panel__muted game-panel__one-line' : 'game-panel__clamp'} title={situation.lastPlay}>
          {situation.lastPlay}
        </div>
      )}
    </>
  )
}

/** Baseball's bases as a diamond of three, each filled when a runner is on it. */
function Bases({ situation }: { situation: GameSituation }) {
  const base = (on: boolean, x: number, y: number) => (
    <rect
      x={x - 3}
      y={y - 3}
      width={6}
      height={6}
      transform={`rotate(45 ${x} ${y})`}
      className={on ? 'game-panel__base--on' : undefined}
    />
  )
  const runners = [situation.onFirst && '1st', situation.onSecond && '2nd', situation.onThird && '3rd'].filter(Boolean)
  return (
    <svg
      className="game-panel__bases"
      viewBox="0 0 24 16"
      role="img"
      aria-label={runners.length > 0 ? `Runners on ${runners.join(', ')}` : 'Bases empty'}
    >
      {base(situation.onThird, 6, 10)}
      {base(situation.onSecond, 12, 5)}
      {base(situation.onFirst, 18, 10)}
    </svg>
  )
}

/** Soccer's goals and cards, the latest first, as many as fit; every one is listed on hover. */
function KeyEvents({ events }: { events: KeyEvent[] }) {
  const mark = (event: KeyEvent) => (isGoal(event) ? 'goal' : event.kind === 'RedCard' ? 'red' : 'yellow')
  return (
    <ul className="game-panel__events" title={keyEventsSummary(events)}>
      {events
        .map((event, i) => ({ event, key: i }))
        .reverse()
        .map(({ event, key }) => (
          <li key={key}>
            <span className={`game-panel__event-mark game-panel__event-mark--${mark(event)}`} />
            <span className="game-panel__strong">{event.clock}</span> {keyEventName(event)}{' '}
            <span className="game-panel__muted">{event.team}</span>
          </li>
        ))}
    </ul>
  )
}
