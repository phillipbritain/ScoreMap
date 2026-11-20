import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode, type Ref } from 'react'
import { boutLine, shownBout } from '../games/bouts'
import { positionText, type Game, type GameBout, type GameBoutSide, type GameEntrant, type GameField, type GameTeam } from '../games/game'
import { mapsSearchUrl, venuePlace } from './venuePlace'
import { progressLine } from '../games/progressLine'
import { sidesTopFirst } from '../games/sides'
import { TeamLogoImage } from '../games/TeamLogoImage'
import { spotlightElapsed, type Scorer } from '../games/scorers'
import { streamLinks } from './streamLinks'
import type { StreamLink } from '../games/game'
import { useSwipeToClose } from './useSwipeToClose'
import { boutChip, chipSizers, fieldLines } from './panelLines'
import { GameDetailsPanel, WatchInfo } from './GameDetailsPanel'
import { useGameDetails } from './useGameDetails'

/** ESPN's red wordmark, from ESPN's own image server, as the link to a game's page on ESPN. */
const espnLogoUrl = 'https://a.espncdn.com/redesign/assets/img/logos/espn-404@2x.png'

/** StreamEast's logo ("STREAM" and "EAST" on a pill, on its red), as the link to a game's stream there. */
const streamEastLogoUrl = '/streameast-logo.png'

/** How long a closed panel takes to go, in milliseconds: its way out is the CSS's (`.game-panel--leaving`). */
export const panelLeaveDuration = 160

interface GamePanelProps {
  game: Game
  /** The side that last scored, lit up for a moment (see justHappened.ts); none since the last snapshot. */
  scorer?: Scorer
  /** The game's color (see gameColor), for the panel's top edge, glow and progress line. */
  color: string
  /** The color of text on the game's color, readable on it (see textOn). */
  textOnColor: string
  /** Whether to show the venue's photo (the viewer's "Venue photos" switch); off, the faint glow shows in its place. */
  venuePhotos: boolean
  /** Whether the game is a demo's, whose details come from the demo board. */
  demo?: boolean
  onClose: () => void
  /**
   * Whether the panel is on its way out, closed (see .game-panel--leaving): it can't be used meanwhile.
   * It plays the default way out unless whatever closed it set the panel's data-leave to play its own.
   */
  leaving?: boolean
  /** The panel's element, so the globe can keep the selected pin clear of it. */
  ref?: Ref<HTMLElement>
}

/**
 * The selected game's score and venue above a collapsible details pane. Venue photos stay
 * anchored to the header; the details and any sport-specific band scroll on short screens.
 */
export function GamePanel({ game, scorer, color, textOnColor, venuePhotos, demo = false, onClose, leaving = false, ref }: GamePanelProps) {
  const [shown, setShown] = useState({ gameId: game.id, details: false, watch: false })
  if (shown.gameId !== game.id) setShown({ gameId: game.id, details: false, watch: false })
  const showingDetails = !leaving && shown.gameId === game.id && (shown.details || shown.watch)
  const { data: details, failed } = useGameDetails(game, showingDetails, demo)
  const { venue } = game
  const place = venuePlace(venue)
  // A tennis match's venue is its tournament, which its note already names, so it shows the court and city on one line.
  const tennis = game.sport === 'Tennis'
  const venueName = (tennis ? [venue.court, place].filter(Boolean).join(' · ') : venue.name) || 'Unknown venue'
  // The place under the venue's name; in tennis, already on the venue's line.
  const placeLine = tennis ? '' : place
  const progress = progressLine(game, 'full')
  const leagueLabel = (
    <div className="game-panel__league" data-tooltip={game.league} data-tooltip-when-clipped>
      {game.league}
    </div>
  )
  const progressChip = progress && (
    <div className="game-panel__progress" data-tooltip={progress} data-tooltip-when-clipped>
      {progress}
    </div>
  )
  const { contest } = game
  // Unofficial stream links (ADR-0002: hobby v1 only); see streamLinks.ts for removal.
  const links = streamLinks(game.streamLinks)
  // A photo that fails to load is left out rather than shown broken. Its credit isn't shown (ADR-0025).
  const [brokenPhotoUrl, setBrokenPhotoUrl] = useState<string | null>(null)
  const photo = venuePhotos && venue.photo && venue.photo.url !== brokenPhotoUrl ? venue.photo : null
  // Lit in the game's color, as its score card is.
  const colorStyle = { '--game-color': color, '--text-on-game-color': textOnColor } as CSSProperties
  // On a phone, swiped down to close (see useSwipeToClose).
  const swipe = useSwipeToClose(game.id, onClose)

  return (
    <aside
      ref={ref}
      className={leaving ? 'game-panel game-panel--leaving' : 'game-panel'}
      style={colorStyle}
      aria-label="Game panel"
      aria-hidden={leaving || undefined}
      inert={leaving}
      {...swipe}
      onKeyDown={(event) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        onClose()
      }
    }}>
      {/* Everything in the panel, clipped to its corners, the close button in its top right corner. */}
      <div className="game-panel__body">
        <div className="game-panel__main">
          <div className="game-panel__score">
            <div className="game-details-score-header">{leagueLabel}{progressChip}</div>
            {contest.kind === 'sides' && sidesTopFirst(game.sport, contest).map((team, i, teams) => (
                <TeamRow key={i} team={team} scores={teams.map(teamScore)} scoredAt={scorer && contest[scorer.side] === team ? scorer.at : null} />
              ))}
            {contest.kind === 'field' && <FieldRows field={contest} name={game.note} />}
            {contest.kind === 'bouts' && <BoutRows bout={shownBout(contest)} />}
          </div>

          {/* The venue and its watch links over the venue's photo, or a faint glow in its place when there's none or the viewer switched photos off. */}
          <div className="game-panel__details">
            {photo && (
              <img className="game-panel__photo" src={photo.url} alt={venue.name ?? 'The venue'} onError={() => setBrokenPhotoUrl(photo.url)} />
            )}
            <div className="game-panel__venue">
              <div className="game-panel__value" data-tooltip={venueName} data-tooltip-when-clipped>
                {venue.name ? <MapsLink query={[venue.name, place].filter(Boolean).join(', ')}>{venueName}</MapsLink> : venueName}
              </div>
              {/* Its line held when there's none, so the panel keeps its height. */}
              <div className="game-panel__muted game-panel__place" data-tooltip={placeLine || undefined} data-tooltip-when-clipped>
                {placeLine && <MapsLink query={placeLine}>{placeLine}</MapsLink>}
              </div>
            </div>
            <div className="game-panel__watch">
              <WatchInfo key={game.id} details={details} failed={failed} onToggle={(watch) => setShown((current) => ({ ...current, watch }))}>
                {(game.espnUrl || links.length > 0) && <WatchLinks links={links} espnUrl={game.espnUrl} />}
              </WatchInfo>
            </div>
          </div>
        </div>

        <GameBand game={game} />
        <GameDetailsPanel key={game.id} game={game} details={details} failed={failed}
          onToggle={(details) => setShown((current) => ({ ...current, details }))} />

        <button type="button" className="game-panel__close" onClick={onClose} aria-label="Close game panel">
          ×
        </button>
      </div>
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

/** The game's StreamEast and ESPN links as logo buttons. */
function WatchLinks({ links, espnUrl }: { links: StreamLink[]; espnUrl: string | null }) {
  return (
    <>
      {links.map((link) => (
        <a key={link.url} className="game-panel__logo-link" href={link.url} target="_blank"
          rel="noopener noreferrer nofollow" aria-label={`${link.site} (unofficial stream)`}>
          <img className="game-panel__stream-logo" src={streamEastLogoUrl} alt="" />
        </a>
      ))}
      {espnUrl && (
        <a className="game-panel__logo-link" href={espnUrl} target="_blank" rel="noopener noreferrer">
          <img className="game-panel__espn-logo" src={espnLogoUrl} alt="The game on ESPN" />
        </a>
      )}
    </>
  )
}

/**
 * A team: its logo, its poll ranking if it has one, its name, its record and its score. Lit up for a
 * moment when it scores (scoredAt, the clock's time), as its score card's row is.
 */
function TeamRow({ team, scores, scoredAt }: { team: GameTeam; scores: string[]; scoredAt: number | null }) {
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
      <TeamLogoImage team={team} markClassName="game-panel__logo game-panel__logo--mark" />
      <span className="game-panel__team-name" data-tooltip={team.record ? `${name} (${team.record})` : name} data-tooltip-when-clipped>
        {team.rank !== null && <span className="game-panel__rank">#{team.rank} </span>}
        {team.fullName}
      </span>
      {team.record && <span className="game-panel__record">{team.record}</span>}
      <ScoreChip score={teamScore(team)} scores={scores} />
    </div>
  )
}

const teamScore = (team: GameTeam): string => team.score ?? '–'

/**
 * A row's score on its slanted chip, as wide as the widest of its rows' scores (scores) so every row's chip
 * is the same width and the scores line up: each of them laid unseen under its own, which sets its width.
 */
function ScoreChip({ score, scores }: { score: string; scores: string[] }) {
  return (
    <span className="game-panel__team-score">
      <span>{score}</span>
      {scores.map((other, i) => (
        <span key={i} className="game-panel__team-score-sizer" aria-hidden="true">
          {other}
        </span>
      ))}
    </span>
  )
}

/**
 * A field's top two entrants by position, as its score card shows them (see FieldLine); before its field is
 * listed, the game's name.
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
  const sizers = chipSizers(field)
  return fieldLines(field).leaders.map((entrant) => <FieldLine key={entrant.name} entrant={entrant} field={field} sizers={sizers} />)
}

/**
 * One of a field on their own line: their flag, position ("T2" when tied) and name, and in golf their score
 * to par on its chip, as wide as every other line's in the field (sizers, see chipSizers).
 */
function FieldLine({ entrant, field, sizers }: { entrant: GameEntrant; field: GameField; sizers: string[] }) {
  const position = positionText(entrant, field)
  return (
    <div className="game-panel__team">
      {entrant.flagUrl ? <img src={entrant.flagUrl} alt="" /> : <span className="game-panel__logo" />}
      <span className="game-panel__team-name" data-tooltip={`${position} ${entrant.name}`} data-tooltip-when-clipped>
        <span className="game-panel__rank">{position} </span>
        {entrant.name}
      </span>
      {entrant.score !== null && <ScoreChip score={entrant.score} scores={sizers} />}
    </div>
  )
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
      <BoutChip side={side} />
    </div>
  ))
}

/** A side's score chip: "W" for the winner, else none, as a fight card has no score to show (see boutChip). */
function BoutChip({ side }: { side: GameBoutSide }) {
  const chip = boutChip(side)
  return chip && <ScoreChip score={chip} scores={[chip]} />
}

const sideWithRecord = ({ name, record }: GameBoutSide): string => (record ? `${name} (${record})` : name)

/**
 * The band under the strip: in tennis the scoreline set by set, or for a field the rest of its leaderboard
 * from 3rd, a line each and scrolling to its last, or for a fight card its bouts, each with its label. None for a game with none of them (its last score is in the
 * score block).
 */
function GameBand({ game }: { game: Game }) {
  const { scoreline, contest } = game
  const field: GameField = contest.kind === 'field' ? contest : { kind: 'field', entries: [] }
  const { rest } = fieldLines(field)
  const sizers = chipSizers(field)
  const bouts = contest.kind === 'bouts' ? contest.bouts : []
  if (!scoreline && rest.length === 0 && bouts.length === 0) return null
  return (
    <div className={rest.length > 0 || bouts.length > 0 ? 'game-panel__band game-panel__band--expanded' : 'game-panel__band'}>
      {rest.length > 0 && (
        <BandCell label="Leaderboard" wide>
          <ol className="game-panel__field-lines">
            {rest.map((entrant) => (
              <li key={entrant.name}>
                <FieldLine entrant={entrant} field={field} sizers={sizers} />
              </li>
            ))}
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
