import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import type { Game, GameSides } from '../games/game'
import { sidesTopFirst } from '../games/sides'
import { RailIcon } from '../rail/railIcons'
import type { GameDetails, GameDrive, GameScoringPlay, GameStatTeam, GameVideo } from './gameDetails'
import './gameDetailsPanel.css'

type DetailTab = 'Score' | 'Scoring' | 'Drives' | 'Stats' | 'Videos'

export function WatchInfo({ details, failed, onToggle, children }: {
  details: GameDetails | null
  failed: boolean
  onToggle: (open: boolean) => void
  children: ReactNode
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const title = useId()
  return (
    <>
      <button type="button" className="game-details-tv" aria-label="Watch and game info" aria-haspopup="dialog" onClick={() => {
        dialog.current?.showModal()
        onToggle(true)
      }}>
        <RailIcon className="game-details-tv-icon">
          <rect x="3" y="4" width="18" height="13" rx="2" />
          <path d="M8 21h8m-4-4v4" />
        </RailIcon>
      </button>
      <dialog ref={dialog} className="game-details-dialog" aria-labelledby={title} onClose={() => onToggle(false)}
        onKeyDown={(event) => { if (event.key === 'Escape') event.stopPropagation() }}>
        <div className="game-details-dialog-heading">
          <h2 id={title}>Watch and game info</h2>
          <button type="button" aria-label="Close watch and game info" onClick={() => dialog.current?.close()}>×</button>
        </div>
        <section>
          <h3>Broadcast network</h3>
          {details?.broadcasts.length
            ? <p>{details.broadcasts.join(' · ')}</p>
            : <DetailsMessage details={details} failed={failed}>No broadcast network listed.</DetailsMessage>}
        </section>
        <section>
          <h3>Game links</h3>
          {children
            ? <div className="game-details-watch-links">{children}</div>
            : <p className="game-details-muted">No links available for this game.</p>}
        </section>
      </dialog>
    </>
  )
}

export function GameDetailsPanel({ game, details, failed, onToggle }: {
  game: Game
  details: GameDetails | null
  failed: boolean
  onToggle: (open: boolean) => void
}) {
  const contest = game.contest.kind === 'sides' ? game.contest : null
  const periodSport = ['Football', 'Basketball', 'Baseball', 'Hockey'].includes(game.sport)
  const tabs: DetailTab[] = []
  if (contest && periodSport) tabs.push('Score')
  if (contest && game.sport !== 'Tennis') tabs.push('Scoring')
  if (contest && game.sport === 'Football') tabs.push('Drives')
  tabs.push('Stats', 'Videos')

  const [selected, setSelected] = useState(tabs[0])
  const [expanded, setExpanded] = useState(false)
  const tabList = useRef<HTMLDivElement>(null)
  const id = useId()
  const active = tabs.includes(selected) ? selected : tabs[0]

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
      <div className="game-details-tab-bar">
        <div ref={tabList} className="game-details-tabs" role="tablist" aria-label="Game details">
          {tabs.map((tab, index) => (
            <button key={tab} id={`${id}-tab-${tab}`} type="button" role="tab"
              aria-selected={expanded && tab === active} aria-controls={`${id}-pane`} tabIndex={tab === active ? 0 : -1}
              onClick={() => {
                setSelected(tab)
                setExpanded(true)
                onToggle(true)
              }} onKeyDown={(event) => moveFocus(event, index)}>
              {tab}
            </button>
          ))}
        </div>
        <button type="button" className="game-details-collapse" aria-label="Collapse game details"
          aria-controls={`${id}-pane`} onClick={collapse}>
          <RailIcon className="game-details-collapse-icon"><path d="m6 9 6 6 6-6" /></RailIcon>
        </button>
      </div>
      <div className="game-details-reveal" inert={!expanded}>
        <div className="game-details-reveal-inner">
          <div key={active} className="game-details-pane" data-panel-scroll role="tabpanel" tabIndex={0}
            id={`${id}-pane`} aria-labelledby={`${id}-tab-${active}`}>
            {active === 'Score' && (contest && details?.periodScores.length
              ? <LineScore game={game} contest={contest} details={details} />
              : <DetailsMessage details={details} failed={failed}>No period scores available.</DetailsMessage>)}
            {active === 'Scoring' && <Scoring game={game} details={details} failed={failed} />}
            {active === 'Drives' && (details?.drives.length
              ? <Drives drives={details.drives} />
              : <DetailsMessage details={details} failed={failed}>No drives available.</DetailsMessage>)}
            {active === 'Stats' && (details?.stats.length
              ? <PlayerStats teams={details.stats} />
              : <DetailsMessage details={details} failed={failed}>No player stats available.</DetailsMessage>)}
            {active === 'Videos' && (details?.videos.length
              ? <Highlights videos={details.videos} />
              : <DetailsMessage details={details} failed={failed}>No videos available.</DetailsMessage>)}
          </div>
        </div>
      </div>
    </div>
  )
}

function LineScore({ game, contest, details }: { game: Game; contest: GameSides; details: GameDetails }) {
  return (
    <div className="game-details-table-scroll">
      {/* No caption on screen: the chart is plainly the score by period. Named for a screen reader. */}
      <table className="game-details-table game-details-line-score"
        aria-label={game.sport === 'Football' ? 'Score by quarter' : 'Line score'}>
        <thead><tr><th scope="col">Team</th>
          {details.periodScores.map((period) => <th key={period.label} scope="col">{period.label}</th>)}
          <th scope="col">{game.status === 'Final' ? 'Final' : 'Total'}</th>
        </tr></thead>
        <tbody>
          {sidesTopFirst(game.sport, contest).map((team) => {
            const home = team === contest.home
            return <tr key={team.abbreviation}><th scope="row">{team.abbreviation}</th>
              {details.periodScores.map((period) => <td key={period.label}>{(home ? period.home : period.away) ?? '–'}</td>)}
              <td>{(home ? details.homeTotal : details.awayTotal) ?? '–'}</td>
            </tr>
          })}
        </tbody>
      </table>
    </div>
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
          <span className="game-details-muted">{when}</span><strong>{team}</strong><span>{text}</span>
          {homeScore !== null && awayScore !== null && <strong className="game-details-running-score">{awayScore}–{homeScore}</strong>}
        </li>
      ))}
    </ol>
  )
}

function Drives({ drives }: { drives: GameDrive[] }) {
  return (
    <ol className="game-details-list game-details-drive-list">
      {drives.map(({ team, outcome, scored, plays, yards, duration, start, end }, index) => (
        <li key={index}>
          <strong>{team} <span className="game-details-muted">· Drive {index + 1}</span></strong>
          <span className="game-details-outcome" data-scored={scored}>{outcome ?? 'In progress'}</span>
          <span>{[plays === null ? null : `${plays} plays`, yards === null ? null : `${yards} yards`, duration].filter(Boolean).join(' · ')}</span>
          <span className="game-details-muted">{[start, end].filter(Boolean).join(' → ')}</span>
        </li>
      ))}
    </ol>
  )
}

function PlayerStats({ teams }: { teams: GameStatTeam[] }) {
  const [selected, setSelected] = useState(teams[0].team)
  const team = teams.find((entry) => entry.team === selected) ?? teams[0]
  return (
    <>
      {teams.length > 1 && (
        <div className="game-details-teams" role="group" aria-label="Stats team">
          {teams.map((entry) => (
            <button key={entry.team} type="button" aria-pressed={team === entry}
              onClick={() => setSelected(entry.team)}>{entry.team}</button>
          ))}
        </div>
      )}
      <div className="game-details-stat-tables">
        {team.sections.map(({ name, columns, players }) => (
          <div key={name} className="game-details-table-scroll">
            <table className="game-details-table">
              <caption>{name}</caption>
              <thead><tr><th scope="col">Player</th>{columns.map((column, index) => <th key={index} scope="col">{column}</th>)}</tr></thead>
              <tbody>
                {players.map(({ name: player, values }, index) => (
                  <tr key={index}><th scope="row">{player}</th>{values.map((value, at) => <td key={at}>{value}</td>)}</tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </>
  )
}

function Highlights({ videos }: { videos: GameVideo[] }) {
  return (
    <ul className="game-details-list">
      {videos.map(({ title, url, duration }) => (
        <li key={url}>
          <a className="game-details-video" href={url} target="_blank" rel="noopener noreferrer">
            <strong>{title}</strong>
            <span className="game-details-muted">ESPN{duration !== null
              && ` · ${Math.floor(duration / 60)}:${String(duration % 60).padStart(2, '0')}`}</span>
          </a>
        </li>
      ))}
    </ul>
  )
}

function DetailsMessage({ details, failed, children }: { details: GameDetails | null; failed: boolean; children: string }) {
  return <p className="game-details-muted" role="status">{details
    ? children : failed ? 'Game details are temporarily unavailable.' : 'Loading game details…'}</p>
}
