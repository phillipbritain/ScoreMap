import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import type { Game, GameSides, GameTeam } from '../games/game'
import { sidesTopFirst } from '../games/sides'
import { TeamLogoImage } from '../games/TeamLogoImage'
import { RailIcon } from '../rail/railIcons'
import { anchorWatchDialog, isWatchBackdrop } from './watchDialog'
import type { GameDetails, GameDrive, GameScoringPlay, GameStatTeam } from './gameDetails'
import { GameVideos } from './GameVideos'
import './gameDetailsPanel.css'

type DetailTab = 'Score' | 'Scoring' | 'Drives' | 'Stats' | 'Videos'

/** The TV button and its dialog with broadcast networks and watch links. */
export function WatchInfo({ details, failed, onToggle, children }: {
  details: GameDetails | null
  failed: boolean
  onToggle: (open: boolean) => void
  children: ReactNode
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const pressedBackdrop = useRef(false)
  const networks = details?.broadcasts ?? []
  useLayoutEffect(() => {
    if (dialog.current) return anchorWatchDialog(dialog.current)
  }, [])

  return (
    <>
      <button type="button" className="game-details-tv" aria-label="Watch and event info" data-tooltip="Watch and event info"
        aria-haspopup="dialog" onClick={(event) => {
          // Pointer dismissal doesn't return focus to the trigger. Keyboard dismissal does.
          if (event.detail > 0) event.currentTarget.blur()
          dialog.current?.showModal()
          onToggle(true)
        }}>
        <TvIcon className="game-details-tv-icon" />
      </button>
      <dialog ref={dialog} className="game-details-dialog" aria-label="Where to watch" onClose={() => onToggle(false)}
        onKeyDown={(event) => { if (event.key === 'Escape') event.stopPropagation() }}
        onPointerDown={(event) => { pressedBackdrop.current = event.button === 0 && isWatchBackdrop(event) }}
        onClick={(event) => {
          if (pressedBackdrop.current && isWatchBackdrop(event)) event.currentTarget.close()
          pressedBackdrop.current = false
        }}>
        <button type="button" className="game-details-dialog-close" aria-label="Close watch and event info" onClick={() => dialog.current?.close()}>×</button>
        <div className="game-details-tiles">
          <div className="game-details-tile">
            <div className="game-details-tv-label"><TvIcon className="game-details-tile-icon" /><span>TV</span></div>
            {networks.length ? (
              <ul className="game-details-networks" aria-label="Broadcast networks">
                {networks.map((network) => <li key={network}>{network}</li>)}
              </ul>
            ) : <DetailsMessage details={details} failed={failed}>No broadcast network listed.</DetailsMessage>}
          </div>
          {children}
        </div>
      </dialog>
    </>
  )
}

function TvIcon({ className }: { className: string }) {
  return <RailIcon className={className}><rect x="3" y="4" width="18" height="13" rx="2" /><path d="M8 21h8m-4-4v4" /></RailIcon>
}

export function GameDetailsPanel({ game, details, failed, open, locked = false, onToggle, onTabOpened, onVideosVisibility }: {
  game: Game
  details: GameDetails | null
  failed: boolean
  /** Whether it opens with its details showing, as the last event panel's were left. */
  open: boolean
  /** Whether its tabs (and minimize button) can't be used yet, as in the welcome tour before Event details. */
  locked?: boolean
  onToggle: (open: boolean) => void
  onTabOpened?: () => void
  onVideosVisibility?: (visible: boolean) => void
}) {
  const contest = game.contest.kind === 'sides' ? game.contest : null
  const periodSport = ['Football', 'Basketball', 'Baseball', 'Hockey'].includes(game.sport)
  const tabs: DetailTab[] = []
  if (contest && periodSport) tabs.push('Score')
  if (contest && game.sport !== 'Tennis') tabs.push('Scoring')
  if (contest && game.sport === 'Football') tabs.push('Drives')
  tabs.push('Stats', 'Videos')

  const [selected, setSelected] = useState(tabs[0])
  const [expanded, setExpanded] = useState(open)
  const tabList = useRef<HTMLDivElement>(null)
  const id = useId()
  const active = tabs.includes(selected) ? selected : tabs[0]
  const showingVideos = expanded && active === 'Videos' && !locked
  useEffect(() => onVideosVisibility?.(showingVideos), [onVideosVisibility, showingVideos])
  const videos = details?.videos.length
    ? <GameVideos videos={details.videos} />
    : details || failed
      ? <DetailsMessage details={details} failed={failed}>No videos available.</DetailsMessage>
      : <VideoRowsPlaceholder />

  function collapse() {
    tabList.current?.querySelector<HTMLButtonElement>('[aria-selected="true"]')?.focus()
    setExpanded(false)
    onToggle(false)
  }

  function moveFocus(event: KeyboardEvent, index: number) {
    let next: number
    switch (event.key) {
      case 'ArrowLeft': next = (index + tabs.length - 1) % tabs.length; break
      case 'ArrowRight': next = (index + 1) % tabs.length; break
      case 'Home': next = 0; break
      case 'End': next = tabs.length - 1; break
      default: return
    }
    event.preventDefault()
    event.stopPropagation()
    setSelected(tabs[next])
    tabList.current?.querySelectorAll('button')[next]?.focus()
  }

  return (
    <div className="game-details" data-expanded={expanded} onKeyDown={(event) => {
      if (expanded && event.key === 'Escape') {
        event.stopPropagation()
        collapse()
      }
    }}>
      <div className="game-details-tab-bar" inert={locked}>
        <div ref={tabList} className="game-details-tabs" role="tablist" aria-label="Event details">
          {tabs.map((tab, index) => (
            <button key={tab} id={`${id}-tab-${tab}`} type="button" role="tab"
              aria-selected={expanded && tab === active} aria-controls={`${id}-pane`} tabIndex={tab === active ? 0 : -1}
              onClick={() => {
                setSelected(tab)
                setExpanded(true)
                onToggle(true)
                onTabOpened?.()
              }} onKeyDown={(event) => moveFocus(event, index)}>
              {tab}
            </button>
          ))}
        </div>
        <button type="button" className="game-details-collapse" aria-label="Minimize event details"
          data-tooltip="Minimize event details"
          aria-controls={`${id}-pane`} onClick={collapse}>
          <RailIcon className="game-details-collapse-icon"><path d="m6 9 6 6 6-6" /></RailIcon>
        </button>
      </div>
      <div className="game-details-reveal" inert={!expanded}>
        <div className="game-details-reveal-inner">
          <div key={active} className="game-details-pane" data-panel-scroll data-tab={active} role="tabpanel"
            tabIndex={active === 'Videos' ? -1 : 0}
            id={`${id}-pane`} aria-labelledby={`${id}-tab-${active}`}>
            {active === 'Score' && (contest && details?.periodScores.length
              ? <LineScore game={game} contest={contest} details={details} />
              : <DetailsMessage details={details} failed={failed}>No period scores available.</DetailsMessage>)}
            {active === 'Scoring' && <Scoring game={game} details={details} failed={failed} />}
            {active === 'Drives' && (details?.drives.length
              ? <Drives game={game} drives={details.drives} />
              : <DetailsMessage details={details} failed={failed}>No drives available.</DetailsMessage>)}
            {active === 'Stats' && (details?.stats.length
              ? <PlayerStats game={game} teams={details.stats} />
              : <DetailsMessage details={details} failed={failed}>No player stats available.</DetailsMessage>)}
            {active === 'Videos' && videos}
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * The score by period on its own card, in the middle of the pane: the period being played (the last with a
 * score, while Live) and the leading side's total picked out.
 */
function LineScore({ game, contest, details }: { game: Game; contest: GameSides; details: GameDetails }) {
  const sides = sidesTopFirst(game.sport, contest)
  const total = (team: GameTeam) => (team === contest.home ? details.homeTotal : details.awayTotal)
  const [first, second] = sides.map((team) => Number(total(team) ?? NaN))
  const leading = first > second ? sides[0] : second > first ? sides[1] : null
  const current = game.status === 'Live' ? details.periodScores.findLastIndex((period) => period.home !== null || period.away !== null) : -1
  return (
    <div className="game-details-line-score">
      <div className="game-details-table-scroll game-details-line-score-card">
        {/* No caption on screen: the chart is plainly the score by period. Named for a screen reader. */}
        <table className="game-details-line-score-table"
          aria-label={game.sport === 'Football' ? 'Score by quarter' : 'Line score'}>
          {/* The team column needs no heading on screen; it keeps its name for a screen reader. */}
          <thead><tr><th scope="col" aria-label="Team" />
            {details.periodScores.map((period, i) => <th key={period.label} scope="col" data-current={i === current || undefined}>{period.label}</th>)}
            <th scope="col">{game.status === 'Final' ? 'Final' : 'T'}</th>
          </tr></thead>
          <tbody>
            {sides.map((team) => {
              const home = team === contest.home
              return <tr key={team.abbreviation} data-leading={team === leading || undefined}><th scope="row">{team.abbreviation}</th>
                {details.periodScores.map((period) => <td key={period.label}>{(home ? period.home : period.away) ?? '–'}</td>)}
                <td>{total(team) ?? '–'}</td>
              </tr>
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/** A team of the game by its abbreviation, for its logo; none for one the game doesn't have. */
function teamOf(game: Game, abbreviation: string): GameTeam | null {
  if (game.contest.kind !== 'sides') return null
  return [game.contest.away, game.contest.home].find((team) => team.abbreviation === abbreviation) ?? null
}

/** A team's abbreviation (or its full name, `full`) after its logo, when the game has the team. */
function TeamLabel({ game, abbreviation, full = false }: { game: Game; abbreviation: string; full?: boolean }) {
  const team = teamOf(game, abbreviation)
  return (
    <strong className="game-details-team">
      {team && <TeamLogoImage team={team} className="game-details-logo" markClassName="game-details-logo game-details-logo--mark" />}
      {full ? team?.fullName ?? abbreviation : abbreviation}
    </strong>
  )
}

function Scoring({ game, details, failed }: { game: Game; details: GameDetails | null; failed: boolean }) {
  const keyEvents: GameScoringPlay[] = game.keyEvents
    .filter(({ kind }) => kind !== 'YellowCard' && kind !== 'RedCard')
    .map(({ kind, clock, team, player }) => ({
      when: clock,
      team,
      text: [player, kind.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase()].filter(Boolean).join(' · '),
      awayScore: null,
      homeScore: null,
    }))
  const plays = keyEvents.length ? keyEvents : details?.scoring ?? []
  if (!plays.length) return <DetailsMessage details={details} failed={failed}>No scoring plays available.</DetailsMessage>
  return (
    <ol className="game-details-list">
      {plays.map(({ when, team, text, homeScore, awayScore }, index) => (
        <li key={index} className="game-details-play">
          <span className="game-details-muted">{when}</span><TeamLabel game={game} abbreviation={team} /><span>{text}</span>
          {homeScore !== null && awayScore !== null && <strong className="game-details-running-score">{awayScore}–{homeScore}</strong>}
        </li>
      ))}
    </ol>
  )
}

function Drives({ game, drives }: { game: Game; drives: GameDrive[] }) {
  return (
    <ol className="game-details-list game-details-drive-list">
      {drives.map(({ team, outcome, scored, plays, yards, duration, start, end }, index) => (
        <li key={index}>
          <span className="game-details-drive-head"><TeamLabel game={game} abbreviation={team} /><span className="game-details-muted">· Drive {index + 1}</span></span>
          <span className="game-details-outcome" data-scored={scored}>{outcome ?? 'In progress'}</span>
          <span>{[plays === null ? null : `${plays} plays`, yards === null ? null : `${yards} yards`, duration].filter(Boolean).join(' · ')}</span>
          <span className="game-details-muted">{[start, end].filter(Boolean).join(' → ')}</span>
        </li>
      ))}
    </ol>
  )
}

/**
 * Each category of player stats once, its teams side by side under their names (one over the other on a
 * narrow panel), in the order the game's sides show.
 */
function PlayerStats({ game, teams }: { game: Game; teams: GameStatTeam[] }) {
  const order = game.contest.kind === 'sides' ? sidesTopFirst(game.sport, game.contest).map((team) => team.abbreviation) : []
  const sorted = [...teams].sort((a, b) => order.indexOf(a.team) - order.indexOf(b.team))
  const categories = [...new Set(sorted.flatMap((team) => team.sections.map((section) => section.name)))]
  return (
    <div className="game-details-stats">
      {categories.map((category) => (
        <section key={category} className="game-details-stats-category">
          <h3 className="game-details-section-title">{category}</h3>
          <div className="game-details-stats-teams">
            {sorted.map(({ team, sections }) => {
              const section = sections.find((entry) => entry.name === category)
              return (
                <div key={team}>
                  <div className="game-details-stats-team"><TeamLabel game={game} abbreviation={team} full /></div>
                  {section
                    ? <StatTable name={`${category}, ${teamOf(game, team)?.fullName ?? team}`} columns={section.columns} players={section.players} />
                    : <p className="game-details-muted">None</p>}
                </div>
              )
            })}
          </div>
        </section>
      ))}
    </div>
  )
}

function StatTable({ name, columns, players }: { name: string; columns: string[]; players: { name: string; values: string[] }[] }) {
  return (
    <div className="game-details-table-scroll">
      <table className="game-details-table" aria-label={name}>
        <thead><tr><th scope="col">Player</th>{columns.map((column, index) => <th key={index} scope="col">{column}</th>)}</tr></thead>
        <tbody>
          {players.map(({ name: player, values }, index) => (
            <tr key={index}><th scope="row">{player}</th>{values.map((value, at) => <td key={at}>{value}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function VideoRowsPlaceholder() {
  return (
    <div className="game-details-list" role="status" aria-label="Loading videos">
      {[0, 1].map((row) => (
        <div className="game-details-video game-details-video-placeholder" key={row} aria-hidden="true">
          <span className="game-details-video-thumb" />
          <span className="game-details-video-placeholder-title" />
          <span className="game-details-video-placeholder-source" />
        </div>
      ))}
    </div>
  )
}

function DetailsMessage({ details, failed, children }: { details: GameDetails | null; failed: boolean; children: string }) {
  return <p className="game-details-muted" role="status">{details
    ? children : failed ? 'Event details are temporarily unavailable.' : 'Loading event details…'}</p>
}
