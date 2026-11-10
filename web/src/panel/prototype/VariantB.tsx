// PROTOTYPE (throwaway) variant B, "Side sheet": on a desktop a tall narrow column docked at the left, top to
// bottom, everything stacked and scrolling (the bottom of the globe stays clear). On a phone a bottom sheet
// that peeks (handle, league, the two score rows) and pulls up to most of the screen for the rest.
import { useState } from 'react'
import { Board, VenueBlock, WatchList } from './details'
import { boardLabel, closeOnEscape, colorStyle, panelFacts, type ScoreRow, type VariantProps } from './facts'
import { usePhone, useScoredRow } from './hooks'
import { Mark } from './shared'

export function VariantB({ game, scorer, color, textOnColor, onClose, panelRef }: VariantProps) {
  const facts = panelFacts(game, scorer)
  const phone = usePhone()
  const [expanded, setExpanded] = useState(false)
  const label = boardLabel(game, facts)
  return (
    <aside
      // On a desktop the column isn't a bottom strip, so the globe isn't told about it (panelClearance
      // assumes a strip across the bottom); the sheet on a phone is.
      ref={phone ? panelRef : undefined}
      className={expanded ? 'pp pp-b pp-b--expanded' : 'pp pp-b'}
      style={colorStyle(color, textOnColor)}
      aria-label="Game panel"
      onKeyDown={closeOnEscape(onClose)}
    >
      <button type="button" className="pp-b__handle" aria-expanded={expanded} aria-label={expanded ? 'Show less' : 'Show more'} onClick={() => setExpanded(!expanded)}>
        <span />
      </button>
      <header className="pp-b__header">
        <span className="pp-label pp-b__league">{game.league}</span>
        {facts.progress && <span className="pp-b__progress">{facts.progress}</span>}
        <button type="button" className="game-panel__close pp-close" onClick={onClose} aria-label="Close game panel">
          ×
        </button>
      </header>
      <div className="pp-b__score">
        {facts.rows.map((row) => (
          <BRow key={row.key} row={row} />
        ))}
      </div>
      <div className="pp-b__rest">
        {label && (
          <section className="pp-b__section">
            <h3 className="pp-label">{label}</h3>
            <Board game={game} facts={facts} />
          </section>
        )}
        {facts.photo && <img className="pp-b__photo" src={facts.photo.url} alt="" data-tooltip={facts.photo.credit ?? undefined} />}
        <section className="pp-b__section">
          <h3 className="pp-label">{game.sport} at</h3>
          <VenueBlock facts={facts} />
        </section>
        <section className="pp-b__section">
          <h3 className="pp-label">Watch</h3>
          <WatchList facts={facts} />
        </section>
      </div>
    </aside>
  )
}

function BRow({ row }: { row: ScoreRow }) {
  const ref = useScoredRow<HTMLDivElement>(row.scoredAt)
  return (
    <div ref={ref} className="pp-b__row">
      <Mark url={row.mark} />
      <span className="pp-b__name game-panel__team-name" data-tooltip={row.name} data-tooltip-when-clipped>
        {row.before && <span className="pp-muted">{row.before} </span>}
        {row.name}
        {row.after && <span className="pp-muted pp-b__record"> {row.after}</span>}
      </span>
      {row.value && <span className="pp-b__value game-panel__team-score">{row.value}</span>}
    </div>
  )
}
