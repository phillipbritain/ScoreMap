// PROTOTYPE (throwaway) round 2, variant B, "Compact": today's panel as it is laid out (slanted score block,
// sport, venue and watch, photo, band under it), shrunk: smaller logos, scores and padding, and on a phone the
// details folded into one line under the score.
import { closeOnEscape, colorStyle, panelFacts, type VariantProps } from './facts'
import { CloseButton, InlineBoard, TeamRow, Venue, WatchInline } from './strip'

export function VariantB({ game, scorer, color, textOnColor, onClose, panelRef }: VariantProps) {
  const facts = panelFacts(game, scorer)
  return (
    <aside ref={panelRef} className="pp pp-strip pb" style={colorStyle(color, textOnColor)} aria-label="Game panel" onKeyDown={closeOnEscape(onClose)}>
      <div className="pb__main">
        <div className="pb__score">
          <div className="pp-label">{game.league}</div>
          {facts.rows.map((row) => (
            <TeamRow key={row.key} row={row} prefix="pb" />
          ))}
          {facts.progress && <span className="pp-progress pb__progress">{facts.progress}</span>}
        </div>
        <div className="pb__details">
          <div className="pb__sport">
            <div className="pp-label">Sport</div>
            {game.sport}
          </div>
          <div className="pb__venue">
            <div className="pp-label">Venue</div>
            <Venue facts={facts} />
          </div>
          <div className="pb__watch">
            <div className="pp-label">Watch</div>
            <WatchInline facts={facts} />
          </div>
        </div>
        {facts.photo && <img className="pb__photo" src={facts.photo.url} alt="" data-tooltip={facts.photo.credit ?? undefined} />}
      </div>
      <InlineBoard game={game} facts={facts} prefix="pb" />
      <CloseButton onClose={onClose} />
    </aside>
  )
}
