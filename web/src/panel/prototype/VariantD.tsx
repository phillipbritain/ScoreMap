// PROTOTYPE (throwaway) round 2, variant D, "Head to head": the two sides face each other across one centered
// scoreboard row (name and logo, score – score, logo and name), progress under the scores, so two teams take
// one row instead of two. Under it, today's details and band side by side in one row. A field keeps its two
// rows, as a field has no "versus".
import { closeOnEscape, colorStyle, panelFacts, type ScoreRow, type VariantProps } from './facts'
import { useScoredRow } from './hooks'
import { Mark } from './shared'
import { CloseButton, InlineBoard, TeamRow, Venue, WatchInline } from './strip'

export function VariantD({ game, scorer, color, textOnColor, onClose, panelRef }: VariantProps) {
  const facts = panelFacts(game, scorer)
  const versus = game.contest.kind !== 'field' && facts.rows.length === 2
  return (
    <aside ref={panelRef} className="pp pp-strip pd" style={colorStyle(color, textOnColor)} aria-label="Game panel" onKeyDown={closeOnEscape(onClose)}>
      <div className="pd__board-row">
        <div className="pp-label pd__league">{game.league}</div>
        {versus ? (
          <div className="pd__versus">
            <Side row={facts.rows[0]} />
            <div className="pd__scores">
              <span className="pd__big game-panel__team-score">{facts.rows[0].value}</span>
              <span className="pd__dash">–</span>
              <span className="pd__big game-panel__team-score">{facts.rows[1].value}</span>
            </div>
            <Side row={facts.rows[1]} end />
          </div>
        ) : (
          <div className="pd__field">
            {facts.rows.map((row) => (
              <TeamRow key={row.key} row={row} prefix="pd" />
            ))}
          </div>
        )}
        {facts.progress && <span className="pp-progress pd__progress">{facts.progress}</span>}
      </div>
      <div className="pd__lower">
        <InlineBoard game={game} facts={facts} prefix="pd" />
        <div className="pd__meta">
          <div>
            <div className="pp-label">{game.sport}</div>
            <Venue facts={facts} />
          </div>
          <div>
            <div className="pp-label">Watch</div>
            <WatchInline facts={facts} />
          </div>
        </div>
      </div>
      <CloseButton onClose={onClose} />
    </aside>
  )
}

/** One side of the scoreboard: logo by the scores, name (wrapping) outside it, record under the name. */
function Side({ row, end = false }: { row: ScoreRow; end?: boolean }) {
  const ref = useScoredRow<HTMLDivElement>(row.scoredAt)
  return (
    <div ref={ref} className={end ? 'pd__side pd__side--end' : 'pd__side'}>
      <span className="pd__side-name">
        <span className="game-panel__team-name">
          {row.before && <span className="pp-muted">{row.before} </span>}
          {row.name}
        </span>
        {row.after && <span className="pp-muted pd__record">{row.after}</span>}
      </span>
      <Mark url={row.mark} />
    </div>
  )
}
