// PROTOTYPE (throwaway) round 3, variant D, "Venue card": the photo becomes the venue's card, with its name and
// place written over the foot of it (and the sport over its top); the contest's details move up into the strip
// beside the score, and the watch links go under them. No band row. On a phone the photo card sits between the
// score and the details, across the width.
import { closeOnEscape, colorStyle, panelFacts, type VariantProps } from './facts'
import { CloseButton, InlineBoard, TeamRow, Venue, VenuePhoto, WatchInline } from './strip'

export function VariantD({ game, scorer, color, textOnColor, onClose, panelRef }: VariantProps) {
  const facts = panelFacts(game, scorer)
  return (
    <aside ref={panelRef} className="pp pp-strip qd" style={colorStyle(color, textOnColor)} aria-label="Game panel" onKeyDown={closeOnEscape(onClose)}>
      <div className="qd__score">
        <div className="pp-label">{game.league}</div>
        {facts.rows.map((row) => (
          <TeamRow key={row.key} row={row} prefix="qd" />
        ))}
        {facts.progress && <span className="pp-progress">{facts.progress}</span>}
      </div>
      <div className="qd__middle">
        <InlineBoard game={game} facts={facts} prefix="qd" />
        <div className="qd__watch">
          <span className="pp-label">Watch</span> <WatchInline facts={facts} />
        </div>
      </div>
      <VenuePhoto facts={facts} className="qd__card">
        <span className="qd__sport">{game.sport}</span>
        <div className="qd__venue">
          <Venue facts={facts} />
        </div>
      </VenuePhoto>
      <CloseButton onClose={onClose} />
    </aside>
  )
}
