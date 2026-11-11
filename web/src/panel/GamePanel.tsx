import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode, type Ref } from 'react'
import { boutLine, shownBout } from '../games/bouts'
import { positionText, type Game, type GameBout, type GameBoutSide, type GameEntrant, type GameField, type GameTeam } from '../games/game'
import { mapsSearchUrl, venuePlace } from './venuePlace'
import { progressLine } from '../games/progressLine'
import { sidesTopFirst } from '../games/sides'
import { spotlightElapsed, type Scorer } from '../games/scorers'
import { streamLinks } from './streamLinks'
import { listedWatchLinks, viewerCountry, watchLinks } from './watchLinks'

interface GamePanelProps {
  game: Game
  /** The side that last scored, lit up for a moment (see justHappened.ts); none since the last snapshot. */
  scorer?: Scorer
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
 * (see .game-panel in index.css). The strip is the score block (the league, the score, the progress line
 * and the last score) and the venue and its watch links (if it lists any) over the venue's photo; under it, a band for a
 * field's leaderboard, a fight card's bouts or a tennis match's sets, when the game has them. Team and
 * player names wrap in place; the panel grows to fit them, and never scrolls. Other clipped
 * details keep their tooltips. Re-renders with each snapshot, so it stays current while open.
 */
export function GamePanel({ game, scorer, color, textOnColor, onClose, ref }: GamePanelProps) {
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
  // A photo that fails to load is left out rather than shown broken. Its credit isn't shown (ADR-0025).
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
      {/* Everything but the close button, which sits on its tab above, clipped to the panel's corners. */}
      <div className="game-panel__body">
        <div className="game-panel__main">
          <div className="game-panel__score">
            <div className="game-panel__league" data-tooltip={game.league} data-tooltip-when-clipped>
              {game.league}
            </div>
            {contest.kind === 'sides' && sidesTopFirst(game.sport, contest).map((team, i) => (
                <TeamRow key={i} team={team} scoredAt={scorer && contest[scorer.side] === team ? scorer.at : null} />
              ))}
            {contest.kind === 'field' && <FieldRows field={contest} name={game.note} />}
            {contest.kind === 'bouts' && <BoutRows bout={shownBout(contest)} />}
            {progress && (
              <div className="game-panel__progress" data-tooltip={progress} data-tooltip-when-clipped>
                {progress}
              </div>
            )}
            <LastScore game={game} />
          </div>

          {/* The venue and its watch links over the venue's photo, or a faint glow in its place when there's none. */}
          <div className="game-panel__details">
            {photo && (
              <img className="game-panel__photo" src={photo.url} alt={venue.name ?? 'The venue'} onError={() => setBrokenPhotoUrl(photo.url)} />
            )}
            <div className="game-panel__venue">
              <div className="game-panel__value" data-tooltip={venueName} data-tooltip-when-clipped>
                {venue.name ? <MapsLink query={[venue.name, place].filter(Boolean).join(', ')}>{venueName}</MapsLink> : venueName}
              </div>
              {placeLine && (
                <div className="game-panel__muted game-panel__place" data-tooltip={placeLine} data-tooltip-when-clipped>
                  <MapsLink query={placeLine}>{placeLine}</MapsLink>
                </div>
              )}
            </div>
            {/* Left out when the game lists none. */}
            {links.length > 0 && (
              <div className="game-panel__watch">
                <span className="game-panel__label">Watch</span> <WatchLinks links={links} />
              </div>
            )}
          </div>
        </div>

        <GameBand game={game} />
      </div>

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
 * Official watch links, then unofficial streams, on one line: as links where there's a web address and
 * plain names otherwise. The first few are listed; the rest are named on hover over "+N more".
 */
function WatchLinks({ links }: { links: PanelLink[] }) {
  const { listed, folded } = listedWatchLinks(links)
  return (
    <span className="game-panel__links">
      {listed.map((link, i) => (
        <span key={`${link.name} ${link.url}`} data-tooltip={link.unofficial ? `${link.name} (unofficial stream)` : link.name} data-tooltip-when-clipped>
          {i > 0 && ', '}
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
        </span>
      ))}
      {folded.length > 0 && (
        <span className="game-panel__muted" data-tooltip={folded.map((link) => link.name).join(', ')}>
          {' '}
          +{folded.length} more
        </span>
      )}
    </span>
  )
}

/**
 * The last score (who scored and when; in soccer the goal's scorer and minute), under its label at the foot
 * of the score block: one line, cut short with an ellipsis where it's longer, in full on hover. Nothing
 * before a score.
 */
function LastScore({ game }: { game: Game }) {
  const { lastScore } = game
  if (!lastScore) return null
  return (
    <div className="game-panel__last-score">
      <div className="game-panel__label">Last score</div>
      <div className="game-panel__one-line" data-tooltip={`${lastScore.when ?? ''} ${lastScore.team}: ${lastScore.text}`.trim()} data-tooltip-when-clipped>
        <span className="game-panel__strong">
          {lastScore.when && `${lastScore.when} · `}
          {lastScore.team}
        </span>{' '}
        {lastScore.text}
      </div>
    </div>
  )
}

/**
 * A team: its logo, its poll ranking if it has one, its name, its record and its score. Lit up for a
 * moment when it scores (scoredAt, the clock's time), as its score card's row is.
 */
function TeamRow({ team, scoredAt }: { team: GameTeam; scoredAt: number | null }) {
  const name = team.rank !== null ? `#${team.rank} ${team.fullName}` : team.fullName
  const row = useRef<HTMLDivElement>(null)
  // Set on the element rather than rendered, so each score starts the glow afresh and a panel opened
  // partway through one carries on from there (see spotlightElapsed).
  useLayoutEffect(() => {
    const element = row.current
    if (!element) return
    element.classList.remove('game-panel__team--scored')
    const elapsed = spotlightElapsed(scoredAt === null ? undefined : { side: 'home', at: scoredAt }, performance.now())
    if (elapsed === null) return
    // Reading layout between removing and adding the class restarts a glow already playing.
    void element.offsetWidth
    element.style.setProperty('--scorer-spotlight-delay', `${-elapsed}ms`)
    element.classList.add('game-panel__team--scored')
  }, [scoredAt])
  return (
    <div ref={row} className="game-panel__team">
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
 * The band under the strip: in tennis the scoreline set by set, or for a field its leaderboard, or for a
 * fight card its bouts, each with its label. None for a game with none of them (its last score is in the
 * score block).
 */
function GameBand({ game }: { game: Game }) {
  const { scoreline, contest } = game
  const field: GameField = contest.kind === 'field' ? contest : { kind: 'field', entries: [] }
  const { entries } = field
  const bouts = contest.kind === 'bouts' ? contest.bouts : []
  // Which game the viewer asked to see the whole field of, so selecting another shows its top 10 again.
  const [shownAllOf, setShownAllOf] = useState<string | null>(null)
  const showAll = shownAllOf === game.id
  const toggleShowAll = () => setShownAllOf(showAll ? null : game.id)
  if (!scoreline && entries.length === 0 && bouts.length === 0) return null
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
