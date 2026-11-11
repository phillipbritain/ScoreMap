// PROTOTYPE (throwaway) round 2, variant C, "Narrow card": today's content in a narrower panel (720px at most),
// stacked top to bottom: league and progress, the score, the contest details, then sport, venue and watch on
// one footer line with the photo as a thumbnail. Leaves the globe's sides clear on a desktop.
import { closeOnEscape, colorStyle, panelFacts, type VariantProps } from './facts'
import { CloseButton, InlineBoard, TeamRow, Venue, WatchInline } from './strip'

export function VariantC({ game, scorer, color, textOnColor, onClose, panelRef }: VariantProps) {
  const facts = panelFacts(game, scorer)
  return (
    <aside ref={panelRef} className="pp pp-strip pc" style={colorStyle(color, textOnColor)} aria-label="Game panel" onKeyDown={closeOnEscape(onClose)}>
      <div className="pc__head">
        <span className="pp-label pc__league">{game.league}</span>
        {facts.progress && <span className="pp-progress">{facts.progress}</span>}
        <CloseButton onClose={onClose} />
      </div>
      <div className="pc__score">
        {facts.rows.map((row) => (
          <TeamRow key={row.key} row={row} prefix="pc" />
        ))}
      </div>
      <InlineBoard game={game} facts={facts} prefix="pc" labels={false} />
      <div className="pc__foot">
        {facts.photo && <img className="pc__thumb" src={facts.photo.url} alt="" data-tooltip={facts.photo.credit ?? undefined} />}
        <span className="pc__where">
          <span className="pp-muted">{game.sport} at </span>
          <Venue facts={facts} separator=", " />
        </span>
        <span className="pc__watch">
          <span className="pp-muted">Watch </span>
          <WatchInline facts={facts} max={2} />
        </span>
      </div>
    </aside>
  )
}
