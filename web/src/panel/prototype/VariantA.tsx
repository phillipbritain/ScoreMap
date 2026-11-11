// PROTOTYPE (throwaway) round 3, variant A, "Photo first": today's strip with the venue photo moved to the left
// edge, fading into the score block; the details after the score, the band under the strip. On a phone the
// photo is a short banner across the top with the league and progress over it.
import { closeOnEscape, colorStyle, panelFacts, type VariantProps } from './facts'
import { CloseButton, InlineBoard, TeamRow, Venue, VenuePhoto, WatchInline } from './strip'

export function VariantA({ game, scorer, color, textOnColor, onClose, panelRef }: VariantProps) {
  const facts = panelFacts(game, scorer)
  return (
    <aside ref={panelRef} className="pp pp-strip qa" style={colorStyle(color, textOnColor)} aria-label="Game panel" onKeyDown={closeOnEscape(onClose)}>
      <div className="qa__main">
        <VenuePhoto facts={facts} className="qa__photo">
          <div className="qa__photo-head">
            <span className="pp-label">{game.league}</span>
            {facts.progress && <span className="pp-progress">{facts.progress}</span>}
          </div>
        </VenuePhoto>
        <div className="qa__score">
          <div className="pp-label qa__league">{game.league}</div>
          {facts.rows.map((row) => (
            <TeamRow key={row.key} row={row} prefix="qa" />
          ))}
          {facts.progress && <span className="pp-progress qa__progress">{facts.progress}</span>}
        </div>
        <div className="qa__details">
          <div className="qa__venue">
            <div className="pp-label">{game.sport} · Venue</div>
            <Venue facts={facts} />
          </div>
          <div className="qa__watch">
            <div className="pp-label">Watch</div>
            <WatchInline facts={facts} />
          </div>
        </div>
      </div>
      <InlineBoard game={game} facts={facts} prefix="qa" />
      <CloseButton onClose={onClose} />
    </aside>
  )
}
