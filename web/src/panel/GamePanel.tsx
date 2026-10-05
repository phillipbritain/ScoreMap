import type { Game, GameTeam } from '../games/game'
import { dualTime } from './dualTime'
import { gameProgress } from './gameProgress'

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
  const channels = [...new Set(game.broadcasters.map((b) => b.name))]

  return (
    <aside className="game-panel" aria-label="Game panel">
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
      <p className="game-panel__progress">{gameProgress(game)}</p>

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
        <dd>{channels.length > 0 ? channels.join(', ') : <span className="game-panel__muted">No channels listed</span>}</dd>
      </dl>
    </aside>
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
