// PROTOTYPE (throwaway) variant A, "Score bug": a slim one-line bar (abbreviations and scores, like a TV
// score bug) that expands upward into a details drawer on demand. Takes the least room by default.
import { useState } from 'react'
import { Board, VenueBlock, WatchList } from './details'
import { boardLabel, closeOnEscape, colorStyle, panelFacts, type ScoreRow, type VariantProps } from './facts'
import { useScoredRow } from './hooks'
import { Mark } from './shared'

export function VariantA({ game, scorer, color, textOnColor, onClose, panelRef }: VariantProps) {
  const facts = panelFacts(game, scorer)
  const [open, setOpen] = useState(false)
  const label = boardLabel(game, facts)
  const sides = game.contest.kind === 'sides' && facts.rows.length === 2
  return (
    <aside
      ref={panelRef}
      className={open ? 'pp pp-a pp-a--open' : 'pp pp-a'}
      style={colorStyle(color, textOnColor)}
      aria-label="Game panel"
      onKeyDown={closeOnEscape(onClose)}
    >
      {open && (
        <div className="pp-a__drawer">
          {label && (
            <section className="pp-a__section pp-a__section--board">
              <h3 className="pp-label">{label}</h3>
              <Board game={game} facts={facts} />
            </section>
          )}
          <section className="pp-a__section">
            <h3 className="pp-label">Teams</h3>
            {facts.rows.map((row) => (
              <div key={row.key} className="pp-a__full-name">
                {row.before && <span className="pp-muted">{row.before} </span>}
                {row.name}
                {row.after && <span className="pp-muted"> {row.after}</span>}
              </div>
            ))}
          </section>
          <section className="pp-a__section">
            <h3 className="pp-label">{game.sport} · Venue</h3>
            <VenueBlock facts={facts} />
          </section>
          <section className="pp-a__section">
            <h3 className="pp-label">Watch</h3>
            <WatchList facts={facts} />
          </section>
        </div>
      )}
      <div className="pp-a__bar">
        <span className="pp-a__league" data-tooltip={game.league} data-tooltip-when-clipped>
          {game.league}
        </span>
        <div className={sides ? 'pp-a__score pp-a__score--sides' : 'pp-a__score'}>
          {sides ? (
            <>
              <BugSide row={facts.rows[0]} />
              <span className="pp-a__dash">–</span>
              <BugSide row={facts.rows[1]} mirrored />
            </>
          ) : (
            facts.rows.map((row) => <BugSide key={row.key} row={row} />)
          )}
        </div>
        {facts.progress && <span className="pp-a__progress">{facts.progress}</span>}
        <button type="button" className="pp-a__more" aria-expanded={open} onClick={() => setOpen(!open)}>
          {open ? 'Less ▾' : 'More ▴'}
        </button>
        <button type="button" className="game-panel__close pp-close" onClick={onClose} aria-label="Close game panel">
          ×
        </button>
      </div>
    </aside>
  )
}

function BugSide({ row, mirrored = false }: { row: ScoreRow; mirrored?: boolean }) {
  const ref = useScoredRow<HTMLSpanElement>(row.scoredAt)
  const parts = [
    <Mark key="m" url={row.mark} />,
    <span key="n" className="pp-a__abbr game-panel__team-name" data-tooltip={row.name}>
      {row.before && <span className="pp-muted">{row.before} </span>}
      {row.short}
    </span>,
    row.value && (
      <span key="v" className="pp-a__value game-panel__team-score">
        {row.value}
      </span>
    ),
  ]
  return (
    <span ref={ref} className="pp-a__side">
      {mirrored ? parts.reverse() : parts}
    </span>
  )
}
