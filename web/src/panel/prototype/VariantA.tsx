// PROTOTYPE (throwaway) round 2, variant A, "One row": today's panel with the band moved up beside the score,
// so everything sits in one short row: score block | contest details | venue and watch. No photo.
// On a phone: score, then details, then venue and watch on one line each.
import { closeOnEscape, colorStyle, panelFacts, type VariantProps } from './facts'
import { CloseButton, InlineBoard, TeamRow, Venue, WatchInline } from './strip'

export function VariantA({ game, scorer, color, textOnColor, onClose, panelRef }: VariantProps) {
  const facts = panelFacts(game, scorer)
  return (
    <aside ref={panelRef} className="pp pp-strip pa" style={colorStyle(color, textOnColor)} aria-label="Game panel" onKeyDown={closeOnEscape(onClose)}>
      <div className="pa__score">
        <div className="pa__head">
          <span className="pp-label">{game.league}</span>
          {facts.progress && <span className="pp-progress">{facts.progress}</span>}
        </div>
        {facts.rows.map((row) => (
          <TeamRow key={row.key} row={row} prefix="pa" />
        ))}
      </div>
      <InlineBoard game={game} facts={facts} prefix="pa" />
      <div className="pa__side">
        <div>
          <div className="pp-label">{game.sport}</div>
          <Venue facts={facts} />
        </div>
        <div>
          <div className="pp-label">Watch</div>
          <WatchInline facts={facts} />
        </div>
      </div>
      <CloseButton onClose={onClose} />
    </aside>
  )
}
