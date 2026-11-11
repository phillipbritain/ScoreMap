// PROTOTYPE (throwaway) round 3, variant B, "Band inside": today's strip with the band pulled up into the
// details column (a slim line of sport, venue and watch over the leaderboard, fight card, sets or last score),
// so there's no separate band row. The photo stays at the right. On a phone: the score, then the photo as a
// thumbnail beside the venue and watch, then the details.
import { closeOnEscape, colorStyle, panelFacts, type VariantProps } from './facts'
import { CloseButton, InlineBoard, TeamRow, Venue, VenuePhoto, WatchInline } from './strip'

export function VariantB({ game, scorer, color, textOnColor, onClose, panelRef }: VariantProps) {
  const facts = panelFacts(game, scorer)
  return (
    <aside ref={panelRef} className="pp pp-strip qb" style={colorStyle(color, textOnColor)} aria-label="Game panel" onKeyDown={closeOnEscape(onClose)}>
      <div className="qb__score">
        <div className="pp-label">{game.league}</div>
        {facts.rows.map((row) => (
          <TeamRow key={row.key} row={row} prefix="qb" />
        ))}
        {facts.progress && <span className="pp-progress">{facts.progress}</span>}
      </div>
      <div className="qb__middle">
        <div className="qb__facts">
          <VenuePhoto facts={facts} className="qb__thumb" />
          <div className="qb__lines">
            <span className="qb__line">
              <span className="pp-muted">{game.sport} at </span>
              <Venue facts={facts} separator=" · " />
            </span>
            <span className="qb__line">
              <span className="pp-muted">Watch </span>
              <WatchInline facts={facts} />
            </span>
          </div>
        </div>
        <InlineBoard game={game} facts={facts} prefix="qb" />
      </div>
      <VenuePhoto facts={facts} className="qb__photo" />
      <CloseButton onClose={onClose} />
    </aside>
  )
}
