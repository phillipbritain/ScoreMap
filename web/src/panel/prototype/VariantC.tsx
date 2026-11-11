// PROTOTYPE (throwaway) round 3, variant C, "Big score": the score block takes half the strip with bigger logos,
// names and scores; sport, venue and watch shrink into one narrow stacked column; the photo runs taller and
// wider at the right; the band stays under it, in small type. On a phone the photo sits behind the score block.
import { closeOnEscape, colorStyle, panelFacts, type VariantProps } from './facts'
import { CloseButton, InlineBoard, TeamRow, Venue, VenuePhoto, WatchInline } from './strip'

export function VariantC({ game, scorer, color, textOnColor, onClose, panelRef }: VariantProps) {
  const facts = panelFacts(game, scorer)
  return (
    <aside ref={panelRef} className="pp pp-strip qc" style={colorStyle(color, textOnColor)} aria-label="Game panel" onKeyDown={closeOnEscape(onClose)}>
      <div className="qc__main">
        <div className="qc__score">
          <VenuePhoto facts={facts} className="qc__backdrop" />
          <div className="qc__head">
            <span className="pp-label">{game.league}</span>
            {facts.progress && <span className="pp-progress">{facts.progress}</span>}
          </div>
          {facts.rows.map((row) => (
            <TeamRow key={row.key} row={row} prefix="qc" />
          ))}
        </div>
        <div className="qc__details">
          <div className="pp-label">{game.sport}</div>
          <Venue facts={facts} />
          <div className="pp-label qc__watch-label">Watch</div>
          <WatchInline facts={facts} />
        </div>
        <VenuePhoto facts={facts} className="qc__photo" />
      </div>
      <InlineBoard game={game} facts={facts} prefix="qc" labels={false} />
      <CloseButton onClose={onClose} />
    </aside>
  )
}
