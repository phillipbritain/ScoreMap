// PROTOTYPE (throwaway): small content atoms the game panel variants share; each variant places them its own way.
import { useState } from 'react'
import type { Game, GameBout, GameField } from '../../games/game'
import { boutLine, entrantPosition, type PanelFacts } from './facts'
import { Mark, WatchAnchor } from './shared'

/** A field's leaderboard as a table: position, flag, name, score. Top 10 with a "Show all". */
export function LeaderboardTable({ field, limit = 10 }: { field: GameField; limit?: number }) {
  const [all, setAll] = useState(false)
  const shown = all ? field.entries : field.entries.slice(0, limit)
  return (
    <>
      <table className="pp-board">
        <tbody>
          {shown.map((entrant) => (
            <tr key={entrant.name}>
              <td className="pp-board__pos">{entrantPosition(entrant, field)}</td>
              <td className="pp-board__flag">
                <Mark url={entrant.flagUrl} className="pp-flag" />
              </td>
              <td className="pp-board__name" data-tooltip={entrant.name} data-tooltip-when-clipped>
                {entrant.name}
              </td>
              <td className="pp-board__score">{entrant.score ?? ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {field.entries.length > limit && (
        <button type="button" className="pp-text-button" onClick={() => setAll(!all)}>
          {all ? `Top ${limit}` : `Show all ${field.entries.length}`}
        </button>
      )}
    </>
  )
}

/** A fight card's bouts, one per line: sides (winner bold), then how it stands or its weight class. */
export function BoutList({ bouts, current }: { bouts: GameBout[]; current: GameBout | null }) {
  return (
    <ol className="pp-bouts">
      {bouts.map((bout) => {
        const line = boutLine(bout) || bout.weightClass
        return (
          <li key={bout.id} className={bout === current ? 'pp-bouts__current' : undefined}>
            <span className="pp-bouts__sides">
              <span className={bout.first.winner ? 'pp-strong' : undefined}>{bout.first.shortName}</span> v{' '}
              <span className={bout.second.winner ? 'pp-strong' : undefined}>{bout.second.shortName}</span>
            </span>
            {line && <span className="pp-muted pp-bouts__line">{line}</span>}
          </li>
        )
      })}
    </ol>
  )
}

/** A tennis match's sets as a row of small boxes, then how it ended early and who advanced. */
export function SetBoxes({ game }: { game: Game }) {
  const { scoreline } = game
  if (!scoreline) return null
  return (
    <div className="pp-sets">
      {scoreline.sets.map((set) => (
        <span key={set.name} className="pp-set" data-tooltip={[set.name, set.score, set.winner].filter(Boolean).join(' · ')}>
          <span className="pp-set__name">{set.name}</span>
          <span className="pp-set__score">{set.score}</span>
        </span>
      ))}
      {scoreline.ending && <span className="pp-strong">{scoreline.ending}</span>}
      {scoreline.advanced && <span className="pp-muted">{scoreline.advanced} advances</span>}
    </div>
  )
}

export function LastScore({ game }: { game: Game }) {
  const { lastScore } = game
  if (!lastScore) return null
  return (
    <div className="pp-last">
      <span className="pp-strong">
        {lastScore.when && `${lastScore.when} · `}
        {lastScore.team}
      </span>{' '}
      {lastScore.text}
    </div>
  )
}

/** Whatever the contest has to say beyond the score: leaderboard, fight card, sets, last score. */
export function Board({ game, facts }: { game: Game; facts: PanelFacts }) {
  if (facts.field) return <LeaderboardTable field={facts.field} />
  if (facts.bouts.length > 0) return <BoutList bouts={facts.bouts} current={facts.boutsShown} />
  return (
    <>
      <SetBoxes game={game} />
      <LastScore game={game} />
      {!game.scoreline && !game.lastScore && <div className="pp-muted">No game details yet</div>}
    </>
  )
}

export function VenueBlock({ facts }: { facts: PanelFacts }) {
  return (
    <div className="pp-venue">
      <div>{facts.mapsUrl ? <a className="pp-plain-link" href={facts.mapsUrl} target="_blank" rel="noopener noreferrer">{facts.venueName}</a> : facts.venueName}</div>
      {facts.place && (
        <div className="pp-muted">
          {facts.placeUrl ? <a className="pp-plain-link" href={facts.placeUrl} target="_blank" rel="noopener noreferrer">{facts.place}</a> : facts.place}
        </div>
      )}
    </div>
  )
}

export function WatchList({ facts }: { facts: PanelFacts }) {
  if (facts.links.length === 0) return <div className="pp-muted">No channels listed</div>
  return (
    <ul className="pp-watch">
      {facts.links.map((link) => (
        <li key={`${link.name} ${link.url}`}>
          <WatchAnchor link={link} />
        </li>
      ))}
    </ul>
  )
}
