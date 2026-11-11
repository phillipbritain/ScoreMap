// PROTOTYPE (throwaway) round 3, variant E, "Photo backdrop": Compact's layout (score block, details, band under
// it), with the venue photo filling the whole panel behind the details and band, darkened from the left so the
// text stays readable, rather than a column of its own. On a phone it fills behind everything under the score.
import { closeOnEscape, colorStyle, panelFacts, type VariantProps } from './facts'
import { CloseButton, InlineBoard, TeamRow, Venue, VenuePhoto, WatchInline } from './strip'

export function VariantE({ game, scorer, color, textOnColor, onClose, panelRef }: VariantProps) {
  const facts = panelFacts(game, scorer)
  return (
    <aside ref={panelRef} className="pp pp-strip qe" style={colorStyle(color, textOnColor)} aria-label="Game panel" onKeyDown={closeOnEscape(onClose)}>
      <VenuePhoto facts={facts} className="qe__backdrop" />
      <div className="qe__main">
        <div className="qe__score">
          <div className="pp-label">{game.league}</div>
          {facts.rows.map((row) => (
            <TeamRow key={row.key} row={row} prefix="qe" />
          ))}
          {facts.progress && <span className="pp-progress">{facts.progress}</span>}
        </div>
        <div className="qe__details">
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
      <InlineBoard game={game} facts={facts} prefix="qe" />
      <CloseButton onClose={onClose} />
    </aside>
  )
}
