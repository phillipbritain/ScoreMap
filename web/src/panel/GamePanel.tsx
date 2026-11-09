import { useState, type CSSProperties, type ReactNode, type Ref } from 'react'
import { boutLine, shownBout } from '../games/bouts'
import { positionText, type Game, type GameBout, type GameBoutSide, type GameEntrant, type GameField, type GameTeam, type PhotoCredit } from '../games/game'
import { mapsSearchUrl, venuePlace } from './venuePlace'
import { progressLine } from '../games/progressLine'
import { sidesTopFirst } from '../games/sides'
import { streamLinks } from './streamLinks'
import { listedWatchLinks, viewerCountry, watchLinks } from './watchLinks'

interface GamePanelProps {
  game: Game
  /** The game's color (see gameColor), for the panel's top edge, glow and progress line. */
  color: string
  /** The color of text on the game's color, readable on it (see textOn). */
  textOnColor: string
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
 * (see .game-panel in index.css), with a band under it for sport-specific contest details. It keeps one size
 * whatever the game, so selecting one game after another doesn't make it jump: long text is clipped,
 * with the full text on hover where it's cut off. Re-renders with each new snapshot, so it stays current while open.
 */
export function GamePanel({ game, color, textOnColor, onClose, ref }: GamePanelProps) {
  const { venue } = game
  const place = venuePlace(venue)
  // A tennis match's venue is its tournament, which its note already names, so it shows the court and city on one line.
  const tennis = game.sport === 'Tennis'
  const venueName = (tennis ? [venue.court, place].filter(Boolean).join(' · ') : venue.name) || 'Unknown venue'
  // The place under the venue's name; in tennis, already on the venue's line.
  const placeLine = tennis ? '' : place
  const progress = progressLine(game, 'full')
  const { contest } = game
  const links: PanelLink[] = [
    ...watchLinks(game.broadcasters, viewerCountry(navigator.languages)).map((link) => ({ ...link, unofficial: false })),
    // Unofficial stream links (ADR-0002: hobby v1 only); see streamLinks.ts for removal.
    ...streamLinks(game.streamLinks).map((link) => ({ name: link.site, url: link.url, unofficial: true })),
  ]
  // A photo that fails to load is left out, with its credit, rather than shown broken.
  const [brokenPhotoUrl, setBrokenPhotoUrl] = useState<string | null>(null)
  const photo = venue.photo && venue.photo.url !== brokenPhotoUrl ? venue.photo : null
  // Lit in the game's color, as its score card is.
  const colorStyle = { '--game-color': color, '--text-on-game-color': textOnColor } as CSSProperties

  return (
    <aside ref={ref} className="game-panel" style={colorStyle} aria-label="Game panel" onKeyDown={(event) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        onClose()
      }
    }}>
      <div className="game-panel__main">
        <div className="game-panel__score">
          <div className="game-panel__league" data-tooltip={game.league} data-tooltip-when-clipped>
            {game.league}
          </div>
          {contest.kind === 'sides' && sidesTopFirst(game.sport, contest).map((team, i) => <TeamRow key={i} team={team} />)}
          {contest.kind === 'field' && <FieldRows field={contest} name={game.note} />}
          {contest.kind === 'bouts' && <BoutRows bout={shownBout(contest)} />}
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
 * The credit a Wikimedia Commons photo's license asks for: its author, linking to the photo's page,
 * and its license. Shown over the photo on hover.
 */
function Credit({ credit }: { credit: PhotoCredit }) {
  return (
    <figcaption className="game-panel__credit" data-tooltip={`Photo: ${credit.author}, ${credit.license}, via Wikimedia Commons`} data-tooltip-when-clipped>
      <a href={credit.sourceUrl} target="_blank" rel="noopener noreferrer">
        {credit.author}
      </a>
      {' · '}
      {credit.licenseUrl ? (
        <a href={credit.licenseUrl} target="_blank" rel="noopener noreferrer">
          {credit.license}
        </a>
      ) : (
        credit.license
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
 * A field's top two entrants by position, as its score card shows them, a tie marked ("T2"), with golf's
 * score to par; before its field is listed, the game's name.
 */
function FieldRows({ field, name }: { field: GameField; name: string | null }) {
  if (field.entries.length === 0) return (
      <div className="game-panel__team">
        <span className="game-panel__logo" />
        <span className="game-panel__team-name" data-tooltip={name ?? ''} data-tooltip-when-clipped>
          {name}
        </span>
      </div>
    )
  return field.entries.slice(0, 2).map((entrant) => {
    const position = positionText(entrant, field)
    return (
      <div key={entrant.name} className="game-panel__team">
        {entrant.flagUrl ? <img src={entrant.flagUrl} alt="" /> : <span className="game-panel__logo" />}
        <span className="game-panel__team-name" data-tooltip={`${position} ${entrant.name}`} data-tooltip-when-clipped>
          <span className="game-panel__rank">{position} </span>
          {entrant.name}
        </span>
        {entrant.score !== null && <span className="game-panel__team-score">{entrant.score}</span>}
      </div>
    )
  })
}

/**
 * A fight card's bout on now, else its main event, as its score card shows it: each side's flag, name and
 * record, the winner marked "W".
 */
function BoutRows({ bout }: { bout: GameBout }) {
  return [bout.first, bout.second].map((side) => (
    <div key={side.name} className="game-panel__team">
      {side.flagUrl ? <img src={side.flagUrl} alt="" /> : <span className="game-panel__logo" />}
      <span className="game-panel__team-name" data-tooltip={sideWithRecord(side)} data-tooltip-when-clipped>
        {side.name}
      </span>
      {side.record && <span className="game-panel__record">{side.record}</span>}
      <span className="game-panel__team-score">{side.winner ? 'W' : ''}</span>
    </div>
  ))
}

const sideWithRecord = ({ name, record }: GameBoutSide): string => (record ? `${name} (${record})` : name)

/** How many of a field the band lists until the viewer asks for all of it. */
const leaderboardLength = 10

/**
 * The band under the strip: the last score (who scored and when; in soccer the goal's scorer and
 * minute), or in tennis the scoreline set by set, or for a field its leaderboard, or for a fight card its
 * bouts, each with its label.
 */
function GameBand({ game }: { game: Game }) {
  const { lastScore, scoreline, contest } = game
  const field: GameField = contest.kind === 'field' ? contest : { kind: 'field', entries: [] }
  const { entries } = field
  const bouts = contest.kind === 'bouts' ? contest.bouts : []
  // Which game the viewer asked to see the whole field of, so selecting another shows its top 10 again.
  const [shownAllOf, setShownAllOf] = useState<string | null>(null)
  const showAll = shownAllOf === game.id
  const toggleShowAll = () => setShownAllOf(showAll ? null : game.id)
  const empty = !lastScore && !scoreline && entries.length === 0 && bouts.length === 0
  return (
    <div className={showAll || bouts.length > 0 ? 'game-panel__band game-panel__band--expanded' : 'game-panel__band'}>
      {entries.length > 0 && (
        <BandCell label="Leaderboard" wide>
          <ol className="game-panel__field">
            {entries.slice(0, showAll ? entries.length : leaderboardLength).map((entrant) => (
              <Entrant key={entrant.name} entrant={entrant} field={field} />
            ))}
            {entries.length > leaderboardLength && (
              <li>
                <button type="button" className="game-panel__show-all" onClick={toggleShowAll}>
                  {showAll ? `Top ${leaderboardLength}` : `Show all ${entries.length}`}
                </button>
              </li>
            )}
          </ol>
        </BandCell>
      )}
      {bouts.length > 0 && (
        <BandCell label="Fight card" wide>
          <ol className="game-panel__bouts">
            {bouts.map((bout) => (
              <Bout key={bout.id} bout={bout} />
            ))}
          </ol>
        </BandCell>
      )}
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
      {empty && <div className="game-panel__muted game-panel__band-empty">No game details yet</div>}
    </div>
  )
}

/**
 * One of a field on its leaderboard: their position ("T2" when tied), short name and in golf their score
 * to par, their full name on hover.
 */
function Entrant({ entrant, field }: { entrant: GameEntrant; field: GameField }) {
  return (
    <li className="game-panel__entrant" data-tooltip={entrant.name}>
      <span className="game-panel__rank">{positionText(entrant, field)}</span> {entrant.shortName}
      {entrant.score !== null && <span className="game-panel__strong"> {entrant.score}</span>}
    </li>
  )
}

/**
 * A bout on the fight card: its sides' short names, the winner's in bold, then how it stands (see boutLine),
 * or its weight class before it starts; in full on hover.
 */
function Bout({ bout }: { bout: GameBout }) {
  const line = boutLine(bout) || bout.weightClass
  const tooltip = [`${sideWithRecord(bout.first)} v ${sideWithRecord(bout.second)}`, bout.weightClass, boutLine(bout)]
    .filter(Boolean)
    .join(' · ')
  const side = ({ shortName, winner }: GameBoutSide) => (winner ? <span className="game-panel__strong">{shortName}</span> : shortName)
  return (
    <li className="game-panel__bout" data-tooltip={tooltip}>
      {side(bout.first)} v {side(bout.second)}
      {line && <span className="game-panel__muted"> · {line}</span>}
    </li>
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
